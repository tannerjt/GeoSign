const Store = require('../lib/geoStore.js');
const fs = require('fs');
const through = require('through');
const geojsonStream = require('geojson-stream');

let store = new Store();

fs.createReadStream('./schools.geojson').pipe(geojsonStream.parse())
  .pipe(through(function(f) {
    store.registerLocation(f.geometry.coordinates[1], f.geometry.coordinates[0]);
    store.registerProperties(f.properties);
  })
);
