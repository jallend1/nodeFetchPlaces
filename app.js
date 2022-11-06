// TODO: Once CSV handling is adjusted, automatically extract date and year from CSV and add to checkIfLibraryExists
// TODO: Display dots on map based on number of requests filled
// TODO: Store libraries and coordinates in a database
// TODO: Check if the new library exists in the database
// TODO: If it does not, fetch the coordinates and add it to the database

const { createReadStream, createWriteStream, readFileSync } = require('fs');
const { validateFile } = require('./commandLine');
const { config } = require('dotenv');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const firebaseAccountKey = require('./firebaseAccountKey.json');
const { Client } = require('@googlemaps/google-maps-services-js');
const client = new Client({});
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

// TODO: Update this to be an additional .pipe on the original read stream
const extractDateFromCSV = (localDataSource) => {
  const dataFile = readFileSync(localDataSource, 'utf8');
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
  const convertedJSON = createWriteStream('lendingLibraries.json');
  createReadStream(localDataSource)
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
  if (revisedName.endsWith('COL')) {
    revisedName = revisedName.replace('COL', 'COLLEGE');
  }
  if (revisedName.includes('COL ')) {
    revisedName = revisedName.replace('COL ', 'COLLEGE ');
  }
  if (revisedName.includes('COLL ')) {
    revisedName = revisedName.replace('COLL ', 'COLLEGE ');
  }
  if (revisedName.includes('SCH ')) {
    revisedName = revisedName.replace('SCH ', 'SCHOOL ');
  }
  if (revisedName.includes('SCHL ')) {
    revisedName = revisedName.replace('SCHL ', 'SCHOOL ');
  }
  return revisedName;
};

const fetchCoordinates = () => {
  // Hardcoded to only two libraries for testing purposes
  const sampleInfo = lendingLibraries.slice(0, 4);

  const writeStream = createWriteStream('locations.json', {
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
      // TODO: Incorporate space for borrowing AND lending data in one library's record
      // TODO: Alternately, have one dedicated collection for library location data and another for borrowing/lending data
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
        // ! Commented out so I'm not using all my API calls
        // db.collection('libraries').add({
        //   ...locationData
        // });
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
