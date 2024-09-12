const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();

app.use(cors());
app.use(express.static('public'));

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));

const mySecret = process.env['MONGO_URI'];
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB:", err));

const userSchema = mongoose.Schema({
  username: { type: String, required: true },
});

const exerciseSchema = mongoose.Schema({
  username: { type: String, required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, required: true },
});

const User = mongoose.model('User', userSchema);
const Exercise = mongoose.model('Exercise', exerciseSchema);

function logger(req, res, next) {
  console.log(req.method, req.path, req.params, req.query, req.body);
  next();
}
app.use(logger);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

app.get("/api/users", async (req, res) => {
  try {
    return res.json(await User.find({}));
  } catch (error) {
    console.error(error);
    return res.json({ error: "invalid" });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const existing = await User.findOne({ username: req.body.username }).select({ __v: 0 });
    if (!existing) {
      const newUser = await User.create({ username: req.body.username });
      return res.json({ username: newUser.username, _id: newUser._id });
    }
    return res.json({ username: existing.username, _id: existing._id });
  } catch (error) {
    console.error(error);
    return res.json({ error: "Operation failed" });
  }
});

app.post("/api/users/:_id/exercises", async (req, res) => {
  try {
    const user = await User.findById(req.body[":_id"] || req.params._id);
    if (!user) return res.json({ error: "user doesn't exist" });
    const newExercise = await Exercise.create({
      username: user.username,
      description: req.body.description,
      duration: req.body.duration,
      date: (req.body.date) ? new Date(req.body.date) : new Date(),
    });

    return res.json({
      _id: user._id,
      username: user.username,
      date: newExercise.date.toDateString(),
      duration: newExercise.duration,
      description: newExercise.description,
    });
  } catch (error) {
    console.error(error);
    return res.json({ error: "Operation failed" });
  }
});

app.get("/api/users/:_id/logs", async (req, res) => {
  try {
    let result = {};
    let consultation = {};
    let from = null;
    let to = null;

    const user = await User.findById(req.params._id);

    consultation.username = user.username;
    result._id = user._id;
    result.username = user.username;

    if (req.query.from) {
      from = new Date(req.query.from + "T00:00:00.000-06:00");
      consultation.date = { ...consultation.date, $gte: from };
      result.from = from.toDateString();
    }

    if (req.query.to) {
      to = new Date(req.query.to + "T00:00:00.000-06:00");
      consultation.date = { ...consultation.date, $lte: to };
      result.to = to.toDateString();
    }

    const log = await Exercise.find(consultation).limit(parseInt(req.query.limit)).select({ _id: 0, username: 0, __v: 0 });

    let pseudoLog = [];

    for (let entry of log) {
      pseudoLog.push({ description: entry.description, duration: entry.duration, date: entry.date.toDateString() });
    }

    result.count = log.length;
    result.log = pseudoLog;
    return res.json(result);

  } catch (error) {
    console.error(error);
    return res.json({ error: "Operation failed" });
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
