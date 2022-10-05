const { config } = require('dotenv');
const { Client } = require('@googlemaps/google-maps-services-js');
const client = new Client({});
const fs = require('fs');
const path = require('path');

config();

client
  .findPlaceFromText({
    params: {
      input: 'Anne Arundel County Public Library',
      inputtype: 'textquery',
      fields: ['name', 'geometry'],
      key: process.env.GOOGLE_API_KEY
    }
  })
  .then(({ data }) => {
    const filePath = path.join(__dirname, 'results.json');
    const fileContent = JSON.stringify(data.candidates);
    fs.writeFile(filePath, fileContent, (err) => {
      if (err) {
        console.log(err);
      }
    });
  })
  .catch((e) => {
    console.log(e.response.data);
  });
