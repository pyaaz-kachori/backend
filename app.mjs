// Import Express
// const express = require('express');
// const axios = require('axios');

import express from 'express';
import axios from 'axios';
import { Octokit } from '@octokit/core';

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


app.get('/OrgReview',handler)


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
function AgentOP(commits,comment,name,title,url){
  console.log(commits)
  console.log(comment) //contributor
  console.log(name) //contributor
  console.log(title) // title
  console.log(url)
  var obj = {
    changes: commits,
    discussion: comment,
    contributor : name,
    title:title,
    url:url
  }
  axios.post(storeURL,JSON.stringify(obj));

}

