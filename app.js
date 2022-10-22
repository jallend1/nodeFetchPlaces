// TODO: Adjust CSV handling so it does not require any editing
// TODO: Once CSV handling is adjusted, automatically extract date and year from CSV and add to checkIfLibraryExists
// TODO: Display dots on map based on number of requests filled
// TODO: Store libraries and coordinates in a database
// TODO: Check if the new library exists in the database
// TODO: If it does not, fetch the coordinates and add it to the database

const { config } = require('dotenv');
const { Client } = require('@googlemaps/google-maps-services-js');
const client = new Client({});
const fs = require('fs');
const { parse } = require('csv-parse');
const states = require('./assets/stateBias.json');
const storedLibraries = require('./assets/storedLibraries.json');
const lendingLibraries = [];

config();

const extractDataFromCSV = () => {
  const convertedJSON = fs.createWriteStream('lendingLibraries.json');
  fs.createReadStream('./assets/sep.tsv')
    .pipe(parse({ delimiter: '\t', from_line: 14, relax_column_count: true }))
    .on('data', (row) => {
      // If library actually lent books, add to array
      if (row[7] > 0) {
        const locationInfo = {
          name: row[0],
          institutionSymbol: row[1],
          institutionState: row[2],
          requestsFilled: row[7]
        };
        lendingLibraries.push(locationInfo);
      }
    })
    .on('end', () => {
      // TODO: Why am I writing this to a file? Was I planning on using it later?
      convertedJSON.write(JSON.stringify(lendingLibraries));
      console.log(lendingLibraries);
      // fetchCoordinates();
    });
};

const checkIfLibraryExists = (library) => {
  const libraryExists = storedLibraries.find((storedLibrary) => {
    return storedLibrary.name === library.name;
  });
  if (libraryExists) {
    // Hardcoding date until I update CSV handling
    libraryExists.date = {
      month: 'July',
      year: 2022,
      requestsFilled: library.requestsFilled
    };
    console.log('Its there!');
    console.log(libraryExists);
    console.log(library);
  } else {
    console.log('Not there!');
  }
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

const fetchCoordinates = () => {
  // Hardcoded to only two libraries for testing purposes
  const sampleInfo = lendingLibraries.slice(0, 2);
  const writeStream = fs.createWriteStream('locations.json', {
    flags: 'a'
  });

  const libraryDetails = [];
  sampleInfo.forEach((library, index) => {
    checkIfLibraryExists(library);
    const stateBias = determineLocationBias(library);
    client
      .findPlaceFromText({
        params: {
          input: library.name,
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
            year: 2022,
            month: 9,
            requestsFilled: library.requestsFilled
          }
        };
        libraryDetails.push(locationData);
        if (index === sampleInfo.length - 1) {
          writeStream.write(JSON.stringify(libraryDetails));
        }
      })
      .catch((e) => {
        console.log(e);
      });
  });
};

extractDataFromCSV();
