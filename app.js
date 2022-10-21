// TODO: Adjust CSV handling so it does not require any editing
// TODO: Display dots on map based on number of requests filled
// TODO: Store libraries and coordinates in a database
// TODO: Check if the new library exists in the database
// TODO: If it does not, fetch the coordinates and add it to the database

const { config } = require('dotenv');
const { Client } = require('@googlemaps/google-maps-services-js');
const client = new Client({});
const fs = require('fs');
const { parse } = require('csv-parse');
const { states } = require('./assets/stateBias.json');
const storedLibraries = require('./assets/storedLibraries.json');
const lendingLibraries = [];

config();

const extractDataFromCSV = () => {
  const convertedJSON = fs.createWriteStream('lendingLibraries.json');
  fs.createReadStream('./borrowing-sep-csv.csv')
    .pipe(parse({ delimiter: ',', from_line: 2 }))
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
      convertedJSON.write(JSON.stringify(lendingLibraries));
      fetchCoordinates();
    });
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
