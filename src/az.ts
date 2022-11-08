;(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define('Az', factory) :
  global.Az = factory()
}(this, function () { 'use strict';
  /** @namespace Az **/
  let fs: any;
  if (typeof require != 'undefined' && typeof exports === 'object' && typeof module !== 'undefined') {
    fs = require('fs');
  }

  let Az = {
    load: function(url: any, responseType: any, callback: any) {
      if (fs) {
        fs.readFile(url, { encoding: responseType == 'json' ? 'utf8' : null }, function (err: any, data: any) {
          if (err) {
            callback(err);
            return;
          }

          if (responseType == 'json') {
            callback(null, JSON.parse(data));
          } else
          if (responseType == 'arraybuffer') {
            if (data.buffer) {
              callback(null, data.buffer);
            } else {
              let ab = new ArrayBuffer(data.length);
              let view = new Uint8Array(ab);
              for (let i = 0; i < data.length; ++i) {
                  view[i] = data[i];
              }
              callback(null, ab);
            }
          } else {
            callback(new Error('Unknown responseType'));
          }
        });
        return;
      }

      let xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = responseType;

      xhr.onload = function (e) {
        if (xhr.response) {
          callback && callback(null, xhr.response);
        }
      };

      xhr.send(null);
    },
    extend: function() {
      let result: any = {};
      for (let i = 0; i < arguments.length; i++) {
        for (let key in arguments[i]) {
          result[key] = arguments[i][key];
        }
      }
      return result;
    }
  };

  return Az;
}));
