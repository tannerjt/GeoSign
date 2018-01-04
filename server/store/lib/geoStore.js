// geoStore.js
const crypto = require('crypto');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const adapter = new FileSync('../db.json');

function geoStore() {
  // File json store
  this.db = low(adapter);

  this.registerLocation = function (lat, lng) {
    let hash = crypto.createHash('sha256')
                .update(','.concat(+lat, +lng))
                .digest('hex');
    this.db[hash] = 1;
    this.db.set(hash,
      { contact: 'Geospatial Enterprise Office', type: 'Geometry' }
    ).write();
    return hash;
  }

  this.registerProperties = function (propertiesObj) {
    let hash = crypto.createHash('sha256')
                .update(JSON.stringify(propertiesObj))
                .digest('hex');
    this.db.set(hash,
      { contact: 'Geospatial Enterprise Office', type: 'Geometry' }
    ).write();
    return hash;
  }

  this.lookup = function (hash) {
    return this.db.get(hash) ? true : false;
  }
}

module.exports = geoStore;
