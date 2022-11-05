// TODO: Once CSV handling is adjusted, automatically extract date and year from CSV and add to checkIfLibraryExists
// TODO: Display dots on map based on number of requests filled
// TODO: Store libraries and coordinates in a database
// TODO: Check if the new library exists in the database
// TODO: If it does not, fetch the coordinates and add it to the database

const { config } = require('dotenv');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const firebaseAccountKey = require('./firebaseAccountKey.json');
const { Client } = require('@googlemaps/google-maps-services-js');
const client = new Client({});
const fs = require('fs');
const { parse } = require('csv-parse');
const syncParse = require('csv-parse/sync');
const states = require('./assets/stateBias.json');
const storedLibraries = require('./assets/storedLibraries.json');
const lendingLibraries = [];

config();
initializeApp({
  credential: cert(firebaseAccountKey)
});
const db = getFirestore();

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
  if (!fs.existsSync(args)) {
    console.log(`${args} does not exist in the current directory.`);
    process.exit(1);
  }
  return args;
};

// TODO: Update this to be an additional .pipe on the original read stream
const extractDateFromCSV = (localDataSource) => {
  const dataFile = fs.readFileSync(localDataSource, 'utf8');
  const rawDataDate = syncParse.parse(dataFile, {
    delimiter: '\t',
    from_line: 5,
    to_line: 5
  });
  const dataDateArray = rawDataDate[0][1].split(' ');
  const lowerCaseDateArray = dataDateArray.map((item) => item.toLowerCase());
  return lowerCaseDateArray;
};

const extractDataFromCSV = (localDataSource) => {
  const dataDateArray = extractDateFromCSV(localDataSource);
  // process.exit(1);
  const convertedJSON = fs.createWriteStream('lendingLibraries.json');
  fs.createReadStream(localDataSource)
    .pipe(parse({ delimiter: '\t', from_line: 14, relax_column_count: true }))
    .on('data', (row) => {
      // If library actually lent books, add to array
      if (row[7] > 0) {
        const [fileMonth, fileYear] = dataDateArray;
        const locationInfo = {
          name: row[0],
          institutionSymbol: row[1],
          institutionState: row[2],
          lendingRequestsFilled: row[7],
          lendingRequestsMade: row[4],
          fileYear,
          fileMonth
        };
        lendingLibraries.push(locationInfo);
      }
    })
    .on('end', () => {
      // TODO: Why am I writing this to a file? Was I planning on using it later?
      convertedJSON.write(JSON.stringify(lendingLibraries));
      fetchCoordinates();
    });
};

const checkIfLibraryExists = (library) => {
  console.log(
    storedLibraries.find((storedLibrary) => storedLibrary.name === library.name)
  );
  return storedLibraries.find(
    (storedLibrary) => storedLibrary.name === library.name
  );
  // if (libraryExists) {
  //   // Hardcoding date until I update CSV handling
  //   libraryExists.date = {
  //     month: 'July',
  //     year: 2022,
  //     requestsFilled: library.requestsFilled
  //   };
  // } else {
  //   console.log('Not there!');
  // }
};

// Sets the location bias to the state of the library
const determineLocationBias = (library) => {
  const targetState = states.find(
    (state) => state.abbreviation === library.institutionState
  );
  if (targetState) {
    return [targetState['latitude'], targetState['longitude']];
  } else {
    return null;
  }
};

const fetchFromJSON = (libraryData) => {
  // If the library exists, add the date and number of requests filled to the existing object

  const targetLibrary = storedLibraries.find(
    (storedLibrary) => storedLibrary.name === libraryData.name
  );
  // TODO:
  const testObject = {
    ...targetLibrary,
    test: true
  };
  console.log(testObject);
  // const locationData = {
  //   googleMapsName: data.candidates[0].name,
  //   name: library.name,
  //   latitude: data.candidates[0].geometry.location.lat,
  //   longitude: data.candidates[0].geometry.location.lng,
  //   institutionSymbol: library.institutionSymbol,
  //   institutionState: library.institutionState,
  //   date: {
  //     year: 2022,
  //     month: 9,
  //     requestsFilled: library.requestsFilled
  //   }
  // };
  // TODO: Return the library details from the JSON file in the same format as the one being returned from Google
};

// TODO: Questionable and complicated way to account for OCLC standard abbreviations-- Regex?
const refineSearchTerm = (library) => {
  let revisedName = library.name;
  if (revisedName.includes('PUB ')) {
    revisedName = revisedName.replace('PUB ', 'PUBLIC ');
  }
  if (revisedName.includes('LIBR ')) {
    revisedName = revisedName.replace('LIBR ', 'LIBRARY ');
  }
  if (revisedName.endsWith('LIBR')) {
    revisedName = revisedName.replace('LIBR', 'LIBRARY');
  }
  if (revisedName.includes('CNTY ')) {
    revisedName = revisedName.replace('CNTY ', 'COUNTY ');
  }
  if (revisedName.includes('COMM ')) {
    revisedName = revisedName.replace('COMM ', 'COMMUNITY ');
  }
  if (revisedName.includes('DIST ')) {
    revisedName = revisedName.replace('DIST ', 'DISTRICT ');
  }
  if (revisedName.endsWith('DIST')) {
    revisedName = revisedName.replace('DIST', 'DISTRICT');
  }
  return revisedName;
};

const fetchCoordinates = () => {
  // Hardcoded to only two libraries for testing purposes
  const sampleInfo = lendingLibraries.slice(0, 4);

  const writeStream = fs.createWriteStream('locations.json', {
    flags: 'a'
  });

  const libraryDetails = [];
  sampleInfo.forEach((library, index) => {
    // checkIfLibraryExists(library) ? fetchFromJSON(library) : console.log('No!');
    // TODO: Scaffold out the checkIfLibrary function!
    // TODO: Break out the Google API call into its own function
    const refinedName = refineSearchTerm(library);
    const stateBias = determineLocationBias(library);
    client
      .findPlaceFromText({
        params: {
          input: refinedName,
          inputtype: 'textquery',
          fields: ['name', 'geometry'],
          key: process.env.GOOGLE_API_KEY,
          locationbias: stateBias
        },
        timeout: 1000
      })
      .then(({ data }) => {
        const locationData = {
          googleMapsName: data.candidates[0].name,
          name: library.name,
          latitude: data.candidates[0].geometry.location.lat,
          longitude: data.candidates[0].geometry.location.lng,
          institutionSymbol: library.institutionSymbol,
          institutionState: library.institutionState,
          date: {
            [library.fileYear]: {
              [library.fileMonth]: [
                library.lendingRequestsMade,
                library.lendingRequestsFilled
              ]
            }
          }
        };
        db.collection('libraries').add({
          ...locationData
        });
        libraryDetails.push(locationData);
        if (index === sampleInfo.length - 1) {
          writeStream.write(JSON.stringify(libraryDetails));
        }
        console.log(locationData);
      })
      .catch((e) => {
        console.log(e);
      });
  });
};

const sourceFile = validateFile();
extractDataFromCSV(sourceFile);
