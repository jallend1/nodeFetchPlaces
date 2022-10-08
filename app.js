const { config } = require('dotenv');
const { Client } = require('@googlemaps/google-maps-services-js');
const client = new Client({});
const fs = require('fs');
const { parse } = require('csv-parse');

config();

fs.createReadStream('./borrowing-sep-csv.csv')
  .pipe(parse({ delimiter: ',', from_line: 2 }))
  .on('data', (row) => {
    console.log(row);
  });

const sampleInfo = [
  'ALACHUA CNTY LIBR DIST',
  'ALAMANCE CNTY PUB LIBRS',
  'AMARILLO PUB LIBR',
  'ANACORTES PUB LIBR',
  'ANCHORAGE PUB LIBR'
];

const writeStream = fs.createWriteStream('locations.json', {
  flags: 'a'
});

writeStream.write('[');

sampleInfo.forEach((library, index) => {
  client
    .findPlaceFromText({
      params: {
        input: library,
        inputtype: 'textquery',
        fields: ['name', 'geometry'],
        key: process.env.GOOGLE_API_KEY
      },
      timeout: 1000
    })
    .then(({ data }) => {
      const locationData = {
        name: data.candidates[0].name,
        latitude: data.candidates[0].geometry.location.lat,
        longitude: data.candidates[0].geometry.location.lng,
        institutionSymbol: null,
        date: {
          year: 2022,
          month: 7
        }
      };
      const fileContent = JSON.stringify(locationData);
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
