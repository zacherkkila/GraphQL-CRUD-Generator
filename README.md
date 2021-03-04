# GraphQL CRUD Generator
Quick and dirty graphql CRUD generation by GraphQL introspection


Usage: `npm run generate -- -t <table> -u <graphql_url> [-w:writefile] [-r:replace] -o <output_file>`

Minimal Usage: `npm run generate -- -t users`

Example: `npm run generate -- -t users -u http://localhost:5678 -wr -o Users.graphql`

## Command Line Options

| Command         | Description                                               | Default                  | Required |
| --------------- | --------------------------------------------------------- | -----------------------  | ----------- |
| `--table, -t`   | Table Name                                                | `null`                   | `true` |
| `--url, -u`     | GraphQL endpoint url                                      | `http://localhost:5678`  | `false` |
| `--write, -w`   | Write flag: When set output will append to a file         | `false`                  | `false` |
|` --replace, r`  | Replace flag: When used with -w the file will be replaced | `false`                  | `false` |
| `--out, -o`     | Output file for when -w is set                            | ` <Table>.graphql`       | `false` |
