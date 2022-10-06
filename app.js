const { config } = require('dotenv');
const { Client } = require('@googlemaps/google-maps-services-js');
const client = new Client({});
const fs = require('fs');

config();

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
        lat: data.candidates[0].geometry.location.lat,
        lng: data.candidates[0].geometry.location.lng
      };
      const fileContent = JSON.stringify(locationData);
      if (index === sampleInfo.length - 1) {
        writeStream.write(fileContent + ']');
      } else {
        writeStream.write(fileContent + ',');
        console.log(fileContent);
      }
    })
    .catch((e) => {
      console.log(e);
    });
});
