import express from "express";
import cors from "cors";
import dayjs from "dayjs";
import joi from "joi";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import { stripHtml } from "string-strip-html";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

const errorMessage = "Um erro inesperado ocorreu no servidor!";
setInterval(removeInactive, 15000);

try {
  await mongoClient.connect();
  db = mongoClient.db();
} catch (err) {
  console.log("Server Error");
  console.log(err);
}

async function removeInactive() {
  try {
    const inactiveUsers = await db
      .collection("participants")
      .find({ lastStatus: { $lt: Date.now() - 10000 } })
      .toArray();

    await db
      .collection("participants")
      .deleteMany({ lastStatus: { $lt: Date.now() - 10000 } });

    if (!inactiveUsers || inactiveUsers.length === 0) return;
    inactiveUsers.map(
      async (user) =>
        await db.collection("messages").insertOne({
          from: user.name,
          to: "Todos",
          text: "sai da sala...",
          type: "status",
          time: dayjs().format("hh:mm:ss"),
        })
    );
  } catch (err) {
    console.log(err);
    return errorMessage;
  }
}

function sanitizeMessage(message) {
  const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.any().valid("message", "private_message").required(),
  });

  const messageValidation = messageSchema.validate(message, {
    abortEarly: false,
  });

  if (messageValidation.error) {
    const errors = messageValidation.error.details.map(
      (detail) => detail.message
    );
    return { err: errors };
  }

  const messageSanitized = {
    to: stripHtml(message.to).result.trim(),
    text: stripHtml(message.text).result.trim(),
    type: stripHtml(message.type).result.trim(),
  };

  return messageSanitized;
}

/*------ROUTES--------*/

app.post("/participants", async (req, res) => {
  const user = req.body;

  const userSchema = joi.object({
    name: joi.string().required(),
  });

  const userValidation = userSchema.validate(user, {
    abortEarly: false,
  });

  if (userValidation.error) {
    const errors = userValidation.error.details.map((detail) => detail.message);
    return res.status(422).send(errors);
  }

  const userSanitized = { name: stripHtml(user.name).result.trim() };

  try {
    const userExists = await db
      .collection("participants")
      .findOne({ name: userSanitized.name });

    if (userExists)
      return res.status(409).send("Esse usu??rio j?? est?? cadastrado!");

    await db
      .collection("participants")
      .insertOne({ name: userSanitized.name, lastStatus: Date.now() });
    await db.collection("messages").insertOne({
      from: userSanitized.name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("hh:mm:ss"),
    });

    res.status(201).send("Cadastro efetuado!");
  } catch (err) {
    console.log(err);
    res.status(500).send(errorMessage);
  }
});

app.post("/messages", async (req, res) => {
  const { user } = req.headers;
  const message = req.body;
  const messageSanitized = sanitizeMessage(message);
  if (messageSanitized.err) return res.status(422).send(messageSanitized.err);

  try {
    const userExists = await db
      .collection("participants")
      .findOne({ name: user });

    if (!userExists)
      return res.status(422).send("Mensagem inv??lida, o usu??rio n??o existe!");

    await db.collection("messages").insertOne({
      from: user,
      to: messageSanitized.to,
      text: messageSanitized.text,
      type: messageSanitized.type,
      time: dayjs().format("hh:mm:ss"),
    });

    res.status(201).send("Mensagem enviada!");
  } catch (err) {
    console.log(err);
    res.status(500).send(errorMessage);
  }
});

app.post("/status", async (req, res) => {
  const { user } = req.headers;

  if (!user)
    return res.status(422).send("Um usu??rio v??lido n??o foi informado!");

  try {
    const userExists = await db
      .collection("participants")
      .findOne({ name: user });

    if (!userExists)
      return res.status(404).send("O usu??rio informado n??o existe!");

    const result = await db.collection("participants").updateOne(
      { _id: ObjectId(userExists._id) },
      {
        $set: { lastStatus: Date.now() },
      }
    );

    if (result.modifiedCount === 0)
      return res.status(404).send("Um erro inesperado aconteceu!");

    res.status(200).send("Status atualizado!");
  } catch (err) {
    console.log(err);
    res.status(500).send(errorMessage);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const participants = await db.collection("participants").find().toArray();
    res.send(participants);
  } catch (err) {
    console.log(err);
    res.status(500).send(errorMessage);
  }
});

app.get("/messages/", async (req, res) => {
  const { user } = req.headers;
  const { limit } = req.query;
  const limitNumber = parseInt(limit);

  if (limitNumber <= 0 || (!limitNumber && limit))
    return res.status(422).send("O limite de mensagens informado ?? inv??lido!");

  try {
    const messages = await db
      .collection("messages")
      .find({ $or: [{ from: user }, { to: { $in: ["Todos", user] } }] })
      .toArray();

    if (!limit) return res.status(200).send([...messages].reverse());

    res.status(200).send([...messages].reverse().slice(0, limitNumber));
  } catch (err) {
    console.log(err);
    res.status(500).send(errorMessage);
  }
});

app.delete("/messages/:ID_DA_MENSAGEM", async (req, res) => {
  const { user } = req.headers;
  const messageId = req.params.ID_DA_MENSAGEM;

  try {
    ObjectId(messageId);
  } catch {
    return res.status(404).send("O id enviado ?? inv??lido!");
  }

  try {
    const messageExists = await db
      .collection("messages")
      .findOne({ _id: ObjectId(messageId) });

    if (!messageExists)
      return res.status(404).send("A mensagem buscada n??o existe!");

    if (messageExists.from !== user)
      return res.status(401).send("Acesso negado!");

    await db.collection("messages").deleteOne({ _id: ObjectId(messageId) });

    res.status(200).send("Mensagem exclu??da!");
  } catch (err) {
    console.log(err);
    res.status(500).send(errorMessage);
  }
});

app.put("/messages/:ID_DA_MENSAGEM", async (req, res) => {
  const { user } = req.headers;
  const messageId = req.params.ID_DA_MENSAGEM;
  const message = req.body;

  try {
    ObjectId(messageId);
  } catch {
    return res.status(404).send("O id enviado ?? inv??lido!");
  }

  const messageSanitized = sanitizeMessage(message);
  if (messageSanitized.err) return res.status(422).send(messageSanitized.err);

  try {
    const userExists = await db
      .collection("participants")
      .findOne({ name: user });

    const messageExists = await db
      .collection("messages")
      .findOne({ _id: ObjectId(messageId) });

    if (!userExists)
      return res.status(404).send("O usu??rio informado n??o existe!");
    if (!messageExists)
      return res.status(404).send("A mensagem informada n??o existe!");
    if (messageExists.from !== user)
      return res.status(401).send("Acesso negado!");

    await db.collection("messages").updateOne(
      { _id: ObjectId(messageId) },
      {
        $set: {
          from: user,
          to: messageSanitized.to,
          text: messageSanitized.text,
          type: messageSanitized.type,
        },
      }
    );

    res.status(200).send("Mensagem editada!");
  } catch (err) {
    console.log(err);
    res.status(500).send(errorMessage);
  }
});

app.listen(5000, () => {
  console.log("Server is listening on port 5000");
});
