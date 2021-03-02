import { getIntrospectionQuery } from "graphql";
import { clientMutationId, mutationTypeName, primaryKey, GqlKinds } from './constants'
const fetch = require("node-fetch");
const commandLineArgs = require("command-line-args");
import * as changeCase from "change-case";
const chalk = require("chalk");
const prettier = require("prettier");
const fs = require("fs");


const optionDefinitions = [
  { name: "table", alias: "t", type: String },
  { name: "url", alias: "u", type: String },
  { name: "write", alias: "w", type: Boolean },
  { name: "out", alias: "o", type: String },
  { name: "replace", alias: "r", type: Boolean },
];

const options = commandLineArgs(optionDefinitions)

console.log("GraphQL CRUD Generator\n")
console.log("Usage: npm generate -- -t <table> -u <graphql_url> [-w:writefile] [-r:replace] -o <output_file>")
console.log("Minimal Usage: npm generate -- -t users")
console.log("Example: npm generate -- -t users -u http://localhost:5678 -wr -o Users.graphql\n")

if(!options.table) {
    console.log("Incorrect command line args\n")
    process.exit(0)
}

const tableName = options.table;
const gqlTableName = changeCase.capitalCase(tableName);
const gqlTypeName = changeCase.camelCase(tableName);
const outFile = options.out || gqlTableName + ".graphql";

const url = options.url || "http://localhost:5678/graphql";

console.log(
  chalk.green("Creating .graphql file for table: ") + tableName + "\n"
);

let schema;

const getType = (type) => {
  return schema.types.find((x) => x.name === type);
};

const cleanupGraphqlString = (gqlString) => {
  return gqlString.replace(/,([^,]*)$/, "$1").trim()
}

const getPayload = (objectType, payload = "") => {
  objectType.fields.forEach((field) => {
    if (field.name !== clientMutationId) {
      const type = field.type.ofType || field.type;
      if (type.kind === GqlKinds.SCALAR || type.kind === GqlKinds.ENUM) {
        payload += `${field.name},`;
      }
    }
  });
  return cleanupGraphqlString(payload);
};

const getScalarArgs = (inputType, argsObject, inputString = "", ignorePrimaryKey = false) => {
  inputType.inputFields.forEach((field) => {
    if (field.name !== clientMutationId && !(ignorePrimaryKey && field.name === primaryKey)) {
      const type = field.type.ofType || field.type;
      if (type.kind === GqlKinds.SCALAR || type.kind === GqlKinds.ENUM) {
        inputString += `${field.name}:$${field.name}, `;
        argsObject["$" + field.name] = `${type.name}${
          (field.type.kind === GqlKinds.NON_NULL) ? "!" : ""
        }`;
      } else if (type.kind === GqlKinds.INPUT_OBJECT) {
        const subType = getType(type.name);
        inputString += `${field.name}:{${getScalarArgs(
          subType,
          argsObject,
          inputString,
          ignorePrimaryKey
        )}}, `;
      }
    }
  });
  return cleanupGraphqlString(inputString);
};

const getMutationArgs = (mutation, argsArray, ignorePrimaryKey = false) => {
  const input = mutation.args[0];
  const inputType = getType(input.type.ofType.name);
  return getScalarArgs(inputType, argsArray, "", ignorePrimaryKey);
};

const generateMutationString = (mutationName, ignorePrimaryKey = false) => {
  const mutations = schema.types.find((x) => x.name == mutationTypeName);
  const mutation = mutations.fields.find((x) => x.name === mutationName);

  if (mutation) {
    console.log("Generating mutation: " + mutationName);
    let argsObject = {};
    const inputString = getMutationArgs(mutation, argsObject, ignorePrimaryKey);
    const formattedArgs = JSON.stringify(argsObject)
      .replace("{", "")
      .replace("}", "")
      .replace(/\"/g, "");

    const payloadType = getType(gqlTableName);
    const payload = getPayload(payloadType);

    let mutationString = `
            mutation ${mutationName}(${formattedArgs}) {
                ${mutationName}(
                    input: {${inputString}}
                ) {
                    ${gqlTypeName} {
                        ${payload}
                    }
                }
            }
        `;
    return prettier.format(mutationString, { semi: false, parser: "graphql" });
  } else {
    console.log(chalk.yellow("Could not find " + mutationName));
  }
};

const generateMutations = () => {
  const createMutation = generateMutationString("create" + gqlTableName, true);

  const updateMutation = generateMutationString("update" + gqlTableName);

  const deleteMutation = generateMutationString("delete" + gqlTableName);

  console.log(chalk.green("\nGeneration finished, results below:\n"));

  if (options.replace && options.write) {
    if (fs.existsSync(outFile)) {
      fs.unlinkSync(outFile);
    }
  }

  if (createMutation) {
    writeOutFile(createMutation);
  }

  if (updateMutation) {
    writeOutFile(updateMutation);
  }

  if (deleteMutation) {
    writeOutFile(deleteMutation);
  }
};

const writeOutFile = (data) => {
  console.log(data);
  if (options.write) {
    fs.appendFile(outFile, data + "\n", function (err) {
      if (err) throw err;
    });
  }
};

const fetcher = (params) => {
  return fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  })
    .then(function (response) {
      return response.text();
    })
    .then(function (responseBody) {
      try {
        return JSON.parse(responseBody);
      } catch (e) {
        return responseBody;
      }
    });
};

const init = () => {
  console.log(chalk.magenta("Reading schema at: " + url + "\n"));
  fetcher({ query: getIntrospectionQuery() })
    .then((result) => {
      schema = result.data.__schema;
      generateMutations();
    })
    .catch((err) => {
      console.log(
        chalk.red(
          `Could not post introspection query to ${url}, error below: \n`
        )
      );
      console.error(err);
    });
};

init();
