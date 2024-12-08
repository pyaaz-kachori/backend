// Import Express
// const express = require('express');
// const axios = require('axios');

import express from 'express';
import { Octokit } from '@octokit/core';

import {
  EAS,
  Offchain,
  SchemaEncoder,
  SchemaRegistry,
  NO_EXPIRATION,

} from "@ethereum-attestation-service/eas-sdk";
import pkg from '@ethereum-attestation-service/eas-sdk';
import fs from 'fs';
const { OFFCHAIN_ATTESTATION_VERSION, PartialTypedDataConfig } = pkg;

import { ethers } from "ethers";
import axios from "axios";


import { MongoClient } from 'mongodb';

const mongoUrl = "mongodb+srv://kituuu:YHkBEK8DtlfiXFjE@omegacluster.rtzywxy.mongodb.net/pyaazKachori";

const rpc = "https://eth.merkle.io";
const EASContractAddress = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e"; // Sepolia v0.26
const schema = "string link,string username,string review,string score";
// Initialize the sdk with the address of the EAS Schema contract address
const eas = new EAS(EASContractAddress);
const publisher_url = "https://publisher.walrus-testnet.walrus.space"

const driver = "mongodb+srv://kituuu:YHkBEK8DtlfiXFjE@omegacluster.rtzywxy.mongodb.net/pyaazKachori"


const aggregator_url = "https://aggregator.walrus-testnet.walrus.space"
// Gets a default provider (in production use something else like infura/alchemy)
const provider = ethers.getDefaultProvider("sepolia");
const schemaUID = "0xad36d2219bedd18eba6141f18be268a5225fcfeaf57c22b6c83ff08acab3aaa1"

const storeURL = "http://localhost:8000/pr"

// Connects an ethers style provider/signingProvider to perform read/write functions.
// MUST be a signer to do write operations!
eas.connect(provider);
const signer = new ethers.Wallet("a290bca74f3a742b5f87ddeeefe4c42eda9c0158acda2a3618b37382de1cd95d", rpc);
const offchain = await eas.getOffchain();
async function createOffchainAttestationJSON(encodedData) {
  const NO_EXPIRATION = 0;

  const offchainAttestation = await offchain.signOffchainAttestation(
    {
      recipient: "0x0000000000000000000000000000000000000000",
      expirationTime: NO_EXPIRATION, // Unix timestamp of when attestation expires (0 for no expiration)
      time: BigInt(Math.floor(Date.now() / 1000)), // Unix timestamp of current time
      revocable: true, // Be aware that if your schema is not revocable, this MUST be false
      schema:
        schemaUID,
      refUID:
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      data: encodedData,
    },
    signer
  );

  // delete offchainAttestation["types"];

  return offchainAttestation
}

async function saveToMongoDB(data) {
  const client = new MongoClient(mongoUrl);

  try {
      // Connect to MongoDB
      await client.connect();
      console.log('Connected successfully to MongoDB');

      // Select the database and collection
      const database = client.db('pyaazKachori');
      const collection = database.collection('githubReviews1');

      // Insert the document
      const result = await collection.insertOne({
          organisation: data.organisation,
          link: data.link,
          username: data.username,
          review: data.review,
          score: parseInt(data.score),
          blobId: data.blobId,
          createdAt: new Date()
      });
      console.log(`Document inserted with _id: ${result.insertedId}`);
      return result.insertedId;
  } catch (error) {
      console.error('Error saving to MongoDB:', error);
      throw error;
  } finally {
      // Close the connection
      await client.close();
  }
}

async function uploadBLOB(data) {
  const store_url = `${publisher_url}/v1/store`
  const response = await axios.put(
    store_url,
    data
  )
  return response.data
}

async function downloadBLOB(blob_id) {
  const store_url = `${aggregator_url}/v1/${blob_id}`
  const response = await axios.get(
    store_url
  )
  return response.data
}

async function verifyAttestation(attestation) {
  const EAS_CONFIG = {
    address: attestation.sig.domain.verifyingContract,
    version: attestation.sig.domain.version,
    chainId: attestation.sig.domain.chainId,
  };
  const ofc = new Offchain(EAS_CONFIG, 2);
  const isValidAttestation = offchain.verifyOffchainAttestationSignature(
    attestation.signer,
    attestation.sig
  );
  return isValidAttestation;
}

function convertAttestationObject(inputAttestation, signer) {
  const schemaUID = inputAttestation.message.schema; // Use the schema from the input
  const obj = {
    sig: {
      version: 2, // Fixed version
      domain: {
        name: inputAttestation.domain.name,
        version: inputAttestation.domain.version,
        chainId: inputAttestation.domain.chainId.toString(), // Convert bigint to string
        verifyingContract: inputAttestation.domain.verifyingContract,
      },
      primaryType: inputAttestation.primaryType,
      types: {
        Attest: [
          { name: "version", type: "uint16" },
          { name: "schema", type: "bytes32" },
          { name: "recipient", type: "address" },
          { name: "time", type: "uint64" },
          { name: "expirationTime", type: "uint64" },
          { name: "revocable", type: "bool" },
          { name: "refUID", type: "bytes32" },
          { name: "data", type: "bytes" },
          { name: "salt", type: "bytes32" },
        ],
      },
      signature: {
        r: inputAttestation.signature.r,
        s: inputAttestation.signature.s,
        v: inputAttestation.signature.v,
      },
      uid: inputAttestation.uid,
      message: {
        version: 2, // Fixed version
        schema: schemaUID, // Use the schema from inputAttestation
        recipient: inputAttestation.message.recipient, // Use the recipient from inputAttestation
        time: inputAttestation.message.time.toString(), // Convert bigint to string
        expirationTime: inputAttestation.message.expirationTime.toString(), // Convert bigint to string
        refUID: inputAttestation.message.refUID,
        revocable: inputAttestation.message.revocable,
        data: inputAttestation.message.data,
        nonce: "0", // Add a fixed nonce
        salt: inputAttestation.message.salt,
      },
    },
    signer: "0x864512FDeef2185Bfb8e736Ce5f54dEe09fDa9b4", // Add signer manually or use the provided value
  };

  function replacer(key, value) {
    if (typeof value === "bigint") {
      return value.toString(); // Convert bigint to string
    }
    return value;
  }

  return JSON.stringify(obj, replacer, 2); // Return the JSON string with formatting
}

const octokit = new Octokit({
  auth: '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'
})

// Initialize the app
const app = express();

// Define a port
const PORT = 3000;

// Define a basic route
app.get('/', (req, res) => {
  res.send('Server rrunning fineeeee !!');
});


app.get('/OrgReview', handler)


// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

async function fetchPullRequests(config) {
  try {
    const response = await axios(config);
    return response.data
  } catch (error) {
    console.error(error);
  }
}

async function AgentOP(commits, comment, name, title, url,orgName) {
  // Prepare the object to match FastAPI PRModel
  const changes = commits.map(change => ({
    filename: change.filename,
    raw_url: change.rawURL,
    patch: change.patch
}))
const discussions = comment.map(disc => ({
  username: disc.username,
  body: disc.body
}))
  const obj = {
      url: url, // Pull request URL
      title: title,
      contributor: name, // GitHub username
      changes: changes,
      discussions: discussions
  };

  const config = {
      headers: {
          'Content-Type': 'application/json'
      },
  };

  try {
      // Make POST request to /pr endpoint
      const response = await axios.post(storeURL, obj, config);
      // console.log('Response:', response.data);
      // Parse the response 
      // Assuming response.data is already parsed JSON from FastAPI
      const responseData = JSON.parse(response.data);
      console.log('Response data:', responseData);


      // Continue with the rest of your existing logic
      const schemaEncoder = new SchemaEncoder(schema);
      const encodedData = schemaEncoder.encodeData([
          { name: "link", value: responseData.url, type: "string" },
          { name: "username", value: responseData.username, type: "string" },
          { name: "review", value: String(responseData.explanation), type: "string" },
          { name: "score", value: String(responseData.review_score), type: "string" },
      ]);
      
      const JSONBLOB = await createOffchainAttestationJSON(encodedData)
      const conv = convertAttestationObject(JSONBLOB, signer)
      
      const resp = await uploadBLOB(conv)
      console.log(`Blob id -----> ${resp.newlyCreated.blobObject.blobId}`)
      
      // Prepare data for MongoDB storage
      const mongoData = {
          organisation: orgName,
          link: responseData.url,
          username: responseData.username,
          review: String(responseData.explanation),
          score: String(responseData.review_score),
          blobId: resp.newlyCreated.blobObject.blobId
      };
      console.log("******************************")
      console.log(mongoData)
      // Save to MongoDB
      const mongoId = await saveToMongoDB(mongoData);
      
      return {
          response: responseData,
          blobId: resp.newlyCreated.blobObject.blobId,
          mongoId: mongoId
      };
  } catch (error) {
      console.error('Error in AgentOP:', error);
      
      // More detailed error logging
      if (error.response) {
          // The request was made and the server responded with a status code
          console.error('Error response data:', error.response.data);
          console.error('Error response status:', error.response.status);
          console.error('Error response headers:', error.response.headers);
      } else if (error.request) {
          // The request was made but no response was received
          console.error('Error request:', error.request);
      } else {
          // Something happened in setting up the request that triggered an Error
          console.error('Error message:', error.message);
      }
      
      throw error;
  }
}

async function handler(req, res) {
  const orgName = req.query.orgName;
  const repos = await octokit.request(`GET /orgs/${orgName}/repos`, {
    org: orgName,
    sort: 'updated',
    headers: {
      'X-GitHub-Api-Version': '2022-11-28'
    }
});
if(repos.length > 5){
  res.send("Done")
}
  await Promise.all(repos.data.map(async (repo) => {
    try {
      const pulls = await octokit.request(`GET /repos/${orgName}/${repo.name}/pulls/`, {
        owner: orgName,
        repo: repo.name,
        state: 'all',
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      if(pulls.length > 10){
        res.send("Done")
      }
      // Process each pull request sequentially
      await Promise.all(pulls.data.map(async (pull) => {
        // Initialize arrays for each pull request
        const adjusted_coments_array = [];
        const adjusted_commit_array = [];
        const url = pull.html_url;
        const username = pull.user.login;
        const title = pull.title;
        // Fetch comments
        const comments = await octokit.request(`GET /repos/${orgName}/${repo.name}/pulls/${pull.number}/comments`, {
          owner: orgName,
          repo: repo.name,
          pull_number: pull.number,
          headers: {
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });
        if(comments.length > 10){
          res.send("Done")
        }

        // Process comments
        comments.data.forEach((comment) => {
          adjusted_coments_array.push({
            username: comment.user.login,
            body: comment.body
          });
        });

        // Fetch commits
        const commits = await octokit.request(`GET /repos/${orgName}/${repo.name}/pulls/${pull.number}/commits`, {
          owner: orgName,
          repo: repo.name,
          pull_number: pull.number,
          headers: {
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });
        if(commits.length > 10){
          res.send("Done")
        }
        // Process commits with await to ensure sequential processing
        for (const commit of commits.data) {
          const changes = await octokit.request(`GET /repos/${orgName}/${repo.name}/commits/${commit.sha}`, {
            owner: orgName,
            repo: repo.name,
            ref: commit.sha,
            headers: {
              'X-GitHub-Api-Version': '2022-11-28',
            },
          });
          if(changes>10){
            res.send("Done")
          }

          const files = changes.data.files;
          files.forEach((file) => {
            const obj = {
              filename: file.filename,
              rawURL: file.raw_url,
              patch: file.patch || ""
            };
            if (obj.patch.length > 200) { 
              obj.patch = obj.patch.substring(0, 200)
            }
            adjusted_commit_array.push(obj);
          });
        }

        if (adjusted_commit_array.length > 50) {
          throw new Error("PR is too big " + pull.number);
        }

        // Only call AgentOP after all commits and comments are processed
        const response = AgentOP(adjusted_commit_array, adjusted_coments_array, username, title, url,orgName);
      }));

    } catch (error) {
      console.error(`Error processing repo ${repo.name}:`, error.message);
    }
  }));
  res.send("done");
}


