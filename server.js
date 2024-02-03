const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const fs = require("fs");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const session = require("express-session");
const cors = require("cors");
const bodyParser = require("body-parser");
const ConnectToMongo = require("./connect");
const app = express();
app.use(cors({ origin: "*" }));
app.use(bodyParser.json());
const jwt = require("jsonwebtoken");
ConnectToMongo();
const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  username: { type: String, required: true },
});

const pdfSchema = new mongoose.Schema({
  data: { type: Buffer, required: true },
  contentType: { type: String, required: true },
  email: { type: String, required: true },
  filename: { type: String, required: true },
});

const PDFModel = mongoose.model("PDF", pdfSchema);
UserSchema.methods.validPassword = function (password) {
  return bcrypt.compareSync(password, this.password);
};

const User = mongoose.model("User", UserSchema);
passport.use(
  new LocalStrategy({ usernameField: "email" }, (email, password, done) => {
    User.findOne({ email: email })
      .then((user) => {
        if (!user) return done(null, false, { message: "Incorrect email." });
        if (!user.validPassword(password))
          return done(null, false, { message: "Incorrect password." });
        return done(null, user);
      })
      .catch((err) => {
        if (err) return done(err, null);
      });
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id)
    .then((user) => {
      done(null, user);
    })
    .catch((err) => {
      done(err, null);
    });
});

app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: "superman",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.get("/", (req, res) => {
  res.send({ hello: "Hello from homepage" });
});
app.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res
        .status(401)
        .send({ statusCode: 401, message: "user or password incorrect" });
    }
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        return res
          .status(500)
          .send({ statusCode: 500, message: "Internal server error" });
      }
      const token = jwt.sign({ user: req.user }, "superman", {
        expiresIn: "1d",
      });
      return res.status(200).send({
        token: token,
        statusCode: 200,
        message: "user authenticate successfully",
      });
    });
  })(req, res, next);
});

app.get("/get", async (req, res) => {
  try {
    let token = req.headers.authorization;
    const decodedToken = jwt.verify(token, "superman");
    let _id = decodedToken.user._id;
    res.status(200).send({ decode: decodedToken.user });
  } catch (error) {
    res.status(401).send({ message: "Please login again..." });
  }
});
app.post("/register", (req, res) => {
  const { email, password, username } = req.body;
  console.log(email, password, username);
  const hashedPassword = bcrypt.hashSync(password, 10);
  const newUser = new User({
    email: email,
    password: hashedPassword,
    username: username,
  });
  newUser
    .save()
    .then(() => {
      res
        .status(200)
        .send({ status: 200, message: "user create successfully" });
    })
    .catch((err) => {
      console.error(err);
      res.status(302).send({ status: 302, error: "email already exists" });
    });
});

app.post("/generate", async (req, res) => {
  try {
    let body = req.body;
    const {
      email,
      products,
      tax,
      total_amount_with_gst,
      from,
      to,
      logo,
      number,
    } = body;

    const requestData = {
      apiKey: "5mkjdk8u30otfmtcjn7tgghsge54m8o8glieun451r882sp18q8u34o",
      items: products,
      from: from,
      to: to,
      logo: logo,
      number: number,
      tax: tax,
      notes: "Please pay as soon as possible",
      due_date: Date.now(),
      currency: "INR",
    };
    axios
      .get("https://anyapi.io/api/v1/invoice/generate", {
        params: requestData,
        responseType: "stream",
      })
      .then((response) => {
        const outputFile = `${Date.now()}.pdf`;
        const writeStream = fs.createWriteStream(outputFile);
        response.data.pipe(writeStream);
        writeStream.on("finish", async () => {
          const filePath = outputFile;
          const pdfBuffer = fs.readFileSync(filePath);
          const pdfDocument = new PDFModel({
            email: email,
            data: pdfBuffer,
            contentType: "application/pdf",
            filename: outputFile,
          });
          pdfDocument.save().then((pdfResponse) => {
            // console.log(pdfResponse);
            if (fs.existsSync(`${outputFile}`)) {
              fs.unlinkSync(`${outputFile}`);
            }
            res.status(200).send({ id: pdfResponse._id });
          });
        });
        writeStream.on("error", (err) => {
          res.status(403).send({ error: "some error occured" });
        });
      })
      .catch((err) => {
        res.status(403).send({ error: "Some error occured" });
      });
    // res.send({ message: "success" });
  } catch (error) {
    res.status(403).send({ message: "Internal server error" });
  }
});

app.get("/get-pdf", async (req, res) => {
  try {
    let _id = req.headers._id;
    console.log(_id);
    const pdfDocument = await PDFModel.findOne({ _id: _id });
    if (pdfDocument) {
      res.contentType(pdfDocument.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${pdfDocument.filename}`
      );
      res.send(pdfDocument.data);
    } else {
      res.status(404).send({ message: "Document not found" });
    }
  } catch (error) {
    res.status(403).send({ error: "Internal server error..." });
  }
});
// Start the server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
