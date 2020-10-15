/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

const mongoose = require('mongoose')
const objectId = mongoose.Types.ObjectId
const request = require('request-promise-native')

mongoose.connect(process.env.MONGODB_URI, {useNewUrlParser: true});

const stockSchema = new mongoose.Schema({
  stock: String,
  likes: [String],
});

const Stock = mongoose.model("stock", stockSchema);

if(process.env.NODE_ENV === "test") {
  Stock.remove({}, function(err) { 
    console.log("collection removed") 
  });
}

function refresh_stock(stock, like, ip) {
  return Stock.findOne({stock: stock}).then(res => {
    if(res === null) {
      let entry = new Stock({ 
        stock: stock, 
        likes: like ? [ip] : []
      });
      return entry.save();
    } else {
      if(like && !res.likes.includes(ip)) {
        res.likes.push(ip);
      }
      return res.save();
    }
  });
}


module.exports = function (app) {
  app.route('/api/stock-prices')
    .get(function (req, res){
      const stocks = Array.isArray(req.query.stock) ? req.query.stock : [req.query.stock];
      const like = req.query.hasOwnProperty("like") ? req.query.like : false;
      const promises = [];

      stocks.map(s => s.toUpperCase());

      stocks.forEach(stock => {
        promises.push(refresh_stock(stock, like, req.ip));

        const url = "https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/" + stock + "/quote";
        promises.push(request(url));
      });
      
      Promise.all(promises).then(data => {
        const stocks = []
        for(let i = 0; i < data.length; i+=2) {
          const dbEntry = data[i];
          const apiResponse = JSON.parse(data[i + 1]);
          
          stocks.push({
            stock: dbEntry.stock,
            price: apiResponse.latestPrice.toFixed(2),
            likes: dbEntry.likes.length
          });
        }

        const out = {};
        if(stocks.length > 1) {
          // get relative likes
          const rel_likes = stocks[0].likes - stocks[1].likes;
          out.stockData = [{
            stock: stocks[0].stock,
            price: stocks[0].price,
            rel_likes: rel_likes === 0 ? 0 : rel_likes, // dont output -0
          }, {
            stock: stocks[1].stock,
            price: stocks[1].price,
            rel_likes: rel_likes === 0 ? 0 : -rel_likes, // dont output -0
          }];
        } else {
          out.stockData = stocks[0];
        }
console.log(out);
        res.json(out);
      }).catch(err => {
        console.log(err);
      });
    });
};
