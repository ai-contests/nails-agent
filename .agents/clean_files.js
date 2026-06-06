const fs = require('fs'); fs.unlinkSync('clean.js'); fs.unlinkSync('clean3.js'); fs.unlinkSync('test.js'); fs.rmSync('test-results', {recursive:true, force:true});
