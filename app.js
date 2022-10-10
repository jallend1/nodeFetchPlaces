// TODO: Store libraries and coordinates in a database
// TODO: Check if the new library exists in the database
// TODO: If it does not, fetch the coordinates and store them in the database

const { config } = require('dotenv');
const { Client } = require('@googlemaps/google-maps-services-js');
const client = new Client({});
const fs = require('fs');
const { parse } = require('csv-parse');

config();
const lendingLibraries = [];

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

const fetchCoordinates = () => {
  // const sampleInfo = [
  //   lendingLibraries[0]
  // 'ALACHUA CNTY LIBR DIST'
  // 'ALAMANCE CNTY PUB LIBRS',
  // 'AMARILLO PUB LIBR',
  // 'ANACORTES PUB LIBR',
  // 'ANCHORAGE PUB LIBR'
  // ];

  const sampleInfo = lendingLibraries.slice(0, 15);
  const writeStream = fs.createWriteStream('locations.json', {
    flags: 'a'
  });

  writeStream.write('[');

  sampleInfo.forEach((library, index) => {
    client
      .findPlaceFromText({
        params: {
          input: library.name,
          inputtype: 'textquery',
          fields: ['name', 'geometry'],
          key: process.env.GOOGLE_API_KEY
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
            month: 9
          }
        };
        libraryDetails.push(locationData);
        const fileContent = JSON.stringify(locationData);
        // TODO: This is not actually working anymore!
        // If the library is the last one in the array, close the array, otherwise add a comma
        if (index === sampleInfo.length - 1) {
          writeStream.write(fileContent + ']');
        } else {
          writeStream.write(fileContent + ',');
        }
      })
      .catch((e) => {
        console.log(e);
      });
  });
};

extractDataFromCSV();
