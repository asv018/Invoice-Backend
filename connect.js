const mongoose = require("mongoose");

let ConnectToMongo = async () => {
  await mongoose.connect(
    "mongodb+srv://cse1411shiv:AKD3s2O9QphVEXKY@cluster0.x5qepcz.mongodb.net/"
  );
  console.log("Connected");
};

module.exports = ConnectToMongo;


// AKD3s2O9QphVEXKY
// cse1411shiv