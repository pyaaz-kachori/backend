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

async function handler(req, res) {
  const orgName = req.query.orgName;
  const repos = await octokit.request(`GET /orgs/${orgName}/repos`, {
      org: orgName,
      headers: {
          'X-GitHub-Api-Version': '2022-11-28'
      }
  });
  
  // Use Promise.all to process repos sequentially
  await Promise.all(repos.data.map(async (repo) => {
      console.log(`Processing repository: ${repo.name}`);
  
      try {
          const pulls = await octokit.request(`GET /repos/${orgName}/${repo.name}/pulls/`, {
              owner: orgName,
              repo: repo.name,
              state: 'open',
              headers: {
                  'X-GitHub-Api-Version': '2022-11-28',
              },
          });
            // Process each pull request sequentially
            await Promise.all(pulls.data.map(async (pull) => {
              // Initialize arrays for each pull request
              const adjusted_coments_array = [];
              const adjusted_commit_array = [];
              const url = pull.html_url;
              const username = pull.user.login;
              const title = pull.title;
              console.log(pull)
  
              console.log(username, title);
              console.log("*******************************************************************");
              console.log(`Processing pull request #${pull.number} in repo: ${repo.name}`);
  
              // Fetch comments
              const comments = await octokit.request(`GET /repos/${orgName}/${repo.name}/pulls/${pull.number}/comments`, {
                  owner: orgName,
                  repo: repo.name,
                  pull_number: pull.number,
                  headers: {
                      'X-GitHub-Api-Version': '2022-11-28',
                  },
              });
  
// Process comments
comments.data.forEach((comment) => {
  console.log(`Comment author: ${comment.user.login}`);
  console.log(`Comment body: ${comment.body}`);
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

// Process commits with await to ensure sequential processing
for (const commit of commits.data) {
  // console.log(commit)
  console.log(`Commit message: ${commit.commit.message}`);
  console.log(`Commit SHA: ${commit.sha}`);

  const changes = await octokit.request(`GET /repos/${orgName}/${repo.name}/commits/${commit.sha}`, {
      owner: orgName,
      repo: repo.name,
      ref: commit.sha,
      headers: {
          'X-GitHub-Api-Version': '2022-11-28',
      },
  });

  console.log("File changes -----------------------");
  const files = changes.data.files;
  files.forEach((file) => {
      const obj = {
          filename: file.filename,
          rawURL: file.raw_url,
          patch: file.patch  
      };
      console.log(obj);
      adjusted_commit_array.push(obj);
  });
}

// Only call AgentOP after all commits and comments are processed
const response = AgentOP(adjusted_commit_array, adjusted_coments_array, username, title,url);
}));

} catch (error) {
console.error(`Error processing repo ${repo.name}:`, error);
}
}));

res.send("done");
}


