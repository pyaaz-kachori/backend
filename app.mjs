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


