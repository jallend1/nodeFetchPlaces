const { existsSync } = require('fs');

const getSourceFileFromCommandLine = (args) => {
  if (!args) {
    console.log('Usage: node app.js <filename>');
    process.exit(1);
  } else if (args === 'help') {
    console.log(
      "Accepts WorldShare Lender Transaction Detail Report in .tsv format in the app's directory and outputs a JSON file with the library's name, coordinates, and number of requests filled."
    );
    console.log('Usage: node app.js <filename>');
    console.log('Example: node app.js sep');
    process.exit(1);
  }
  return args.endsWith('.tsv') ? args : args + '.tsv';
};

const validateFile = () => {
  const args = getSourceFileFromCommandLine(process.argv[2]);
  if (!existsSync(args)) {
    console.log(`${args} does not exist in the current directory.`);
    process.exit(1);
  }
  return args;
};

module.exports = {
  validateFile
};
