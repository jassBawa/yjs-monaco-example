import * as Y from 'yjs'
import express from 'express'
import formidable from 'formidable'
import * as jwt from 'lib0/crypto/jwt'
import * as time from 'lib0/time'
import * as ecdsa from 'lib0/crypto/ecdsa'
import * as env from 'lib0/environment'
import * as fs from 'fs/promises'
import * as promise from 'lib0/promise'
import cors from 'cors';

const app = express()
const port = 5173
app.use(cors());

// Read the AUTH_PRIVATE_KEY environment variable and import the JWK
export const authPrivateKey = await ecdsa.importKeyJwk(JSON.parse(env.ensureConf('auth-private-key')))
// Read the AUTH_PUBLIC_KEY environment variable and import the JWK
export const authPublicKey = await ecdsa.importKeyJwk(JSON.parse(env.ensureConf('auth-public-key')))

const appName = 'my-express-app'


// This endpoint is called in regular intervals when the document changes.
// The request contains a multi-part formdata field that can be read, for example, with formidable:
const documents = new Map(); // key: room name, value: Uint8Array or Y.Doc

app.put('/ydoc/:room', async (req, res, next) => {
  const room = req.params.room
  console.log(room);
  const ydocUpdate = await promise.create((resolve, reject) => {
    const form = formidable({})
    form.parse(req, (err, _fields, files) => {
      if (err) {
        next(err)
        reject(err)
        return
      }
      if (files.ydoc) {
        // formidable writes the data to a file by default. This might be a good idea for your
        // application. Check the documentation to find a non-temporary location for the read file.
        // You should probably delete it if it is no longer being used.
        const file = files.ydoc[0]
        // we are just going to log the content and delete the temporary file
        fs.readFile(file.filepath).then(resolve, reject)
      }
    })
  })
   // Update or create the room document
  let ydoc = documents.get(room);
  if (!ydoc) {
    ydoc = new Y.Doc();
    documents.set(room, ydoc);
  }

  Y.applyUpdateV2(ydoc, ydocUpdate)
  console.log(`codemirror content in room "${room}" updated: "${ydoc.getText('monaco').toString().replaceAll('\n', '\\n')}"`)
  res.sendStatus(200)
})

app.get('/ydoc/rooms', (req, res) => {
  res.json([...documents.keys()]);
});

// This example server always grants read-write permission to all requests.
// Modify it to your own needs or implement the same API in your own backend!
app.get('/auth/token', async (_req, res) => {
  const token = await jwt.encodeJwt(authPrivateKey, {
    iss: appName,
    exp: time.getUnixTime() + 60 * 60 * 1000, // token expires in one hour
    yuserid: 'user1' // associate the client with a unique id that can will be used to check permissions
  })
  res.send(token)
})

// This api is called to check whether a specific user (identified by the unique "yuserid") has
// access to a specific room. This rest endpoint is called by the yredis server, not the client.
app.get('/auth/perm/:room/:userid', async (req, res) => {
  const yroom = req.params.room
  const yuserid = req.params.userid
  // This sample-server always grants full acess
  res.send(JSON.stringify({
    yroom,
    yaccess: 'rw', // alternatively, specify "read-only" or "no-access"
    yuserid
  }))
})

// serve static files
app.use(express.static('./'))

const server = app.listen(port, () => {
  console.log(`Express Demo Auth server listening on port ${port}`)
})

// Gracefully shut down the server when running in Docker
process.on('SIGTERM', shutDown)
process.on('SIGINT', shutDown)

function shutDown () {
  console.log('Received SIGTERM/SIGINT - shutting down gracefully')
  server.close(() => {
    console.log('Closed out remaining connections - shutting down')
    process.exit(0)
  })
  setTimeout(() => {
    console.error("Couldn't close connections - forcefully shutting down")
    process.exit(1)
  }, 10000)
}
