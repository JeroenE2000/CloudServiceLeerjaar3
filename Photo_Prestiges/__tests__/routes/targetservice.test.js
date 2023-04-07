/* eslint-disable no-undef */
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod;
let db;

async function createNewTarget(req) {
  // Check if file is present and is an image
  const buffer = req.file.buffer;
  const data = {
    tid: req.body.tid,
    targetName: req.body.targetName,
    description: req.body.description,
    location: {
      coordinates: [req.body.longitude, req.body.latitude],
      placename: req.body.placename
    },
    image: {
      data: buffer,
      contentType: req.file.mimetype
    },
    uid: req.headers.user_id
  };
  if (req.file.mimetype !== "image/png" && req.file.mimetype !== "image/jpeg" && req.file.mimetype !== "image/jpg") {
    return {
      status: 400,
      body: {
        error: "Invalid file. Please upload a valid image file."
      }
    };
  }
      
  await db.collection("targets").insertOne(data);

  return {
    status: 200,
    body: {
      message: "New target created successfully"
    }
  };
}


describe("createNewTarget", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    db = mongoose.connection;
  });

  afterAll(async () => {
    await mongoose.connection.close();
    await mongod.stop();
  });

  it("should create a new target in the database", async () => {
    const tid = Math.floor(Math.random() * 9000000000) + 1000000000;
    const req = {
      file: {
        path: "test.png",
        mimetype: "image/png",
      },
      body: {
        tid: tid,
        targetName: "Test Target",
        description: "This is a test target",
        longitude: 50.1234,
        latitude: 40.5678,
        placename: "Test City",
        uid: 1,
      },
      headers: {
        user_id: 1,
      },
    };

    //Check if file is a PNG or JPEG image
    const allowedMimeTypes = ["image/png", "image/jpeg" , "image/jpeg"];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      const res = await createNewTarget(req);
      expect(res.status).toEqual(400);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toEqual("Invalid file. Please upload a valid image file.");
      return;
    }

    await createNewTarget(req);

    const result = await db.collection("targets").find().toArray();
    result.forEach((target) => {
      if (target.tid === req.body.tid) {
        expect(target.targetName).toEqual(req.body.targetName);
        expect(target.description).toEqual(req.body.description);
        expect(target.location.coordinates).toEqual([req.body.longitude, req.body.latitude]);
        expect(target.location.placename).toEqual(req.body.placename);
        expect(target.tid).toEqual(tid);
        expect(target.uid).toEqual(req.body.uid);
        expect(target.image.data).toBeDefined();
        expect(target.image.contentType).toEqual(req.file.mimetype);
      }
    });
  });
});
  
