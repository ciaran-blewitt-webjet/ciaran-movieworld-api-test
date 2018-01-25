const request = require("request");
const express = require("express");
const app = express();

const RESPONSE_TIMEOUT = 15000; // 15s
const ACCESS_TOKEN = "PLEASE_PUT_TOKEN_HERE";

// Retrieves some JSON data from a URL using the ACCESS_TOKEN to be reused
function GetJSONDataFromURL(url) {
  // Prepare options for HTTP request
  let options = {
    url: url,
    headers: {
      "X-Access-Token": ACCESS_TOKEN
    },
    json: true,
    timeout: RESPONSE_TIMEOUT
  }

  // Return a Promise for HTTP request
  return new Promise(function(resolve, reject) {
    var req = request(options);

    req.on("response", function(response) {
      let data = "";
      response.on("data", function(chunk) {
        data += chunk;
      });

      response.on("end", function() {
        // Check for statusCode and handle correctly
        if (response.statusCode == 200) { // SUCCESS
          try {
            var output = JSON.parse(data);
            resolve(output);
          } catch (e) {
            resolve();
            // reject({error: "Data returned was invalid (JSON)", errorCode: "E-02", content: e}); // reject with error code
          }
        }
        if (response.statusCode == 403) { // CREDENTIAL ISSUE
          console.log("Recieved 403 response; please check that you have the correct credentials!")
          resolve();
        }
        // FEATURE: Extend with other statusCodes as required
        resolve();
        // reject({error: "Data returned was invalid (JSON)", errorCode: "E-02", content: e}); // reject with error code
      });
    });

    req.on('error', function(e) {
      if (e.code == "ESOCKETTIMEDOUT" || e.code == "ETIMEDOUT") {
        console.log("There was a timeout event for", options.url);
        resolve();
        // reject({error: "Request timed out", errorCode: "E-01"}); // reject since it took too long!
      }
      // TODO: Extend this as more issues arise
      reject("(" + e.code + ") something super bad went wrong!");
    });
  });
}

// Load the public directory so frontend can be served
app.use(express.static("public"));

// Retrieve list of movies
app.get("/api/movies", function(req, res, next) {
  // Retrieve data from the two sources
  let promises = [];
  promises.push(GetJSONDataFromURL("http://webjetapitest.azurewebsites.net/api/cinemaworld/movies"));
  promises.push(GetJSONDataFromURL("http://webjetapitest.azurewebsites.net/api/filmworld/movies"));

  // Wait for promises to be filled
  Promise.all(promises).then(function(values) {
    let movie_data = [];
    // Retrieve all the movies from (hopefully) both sources
    values.forEach(function(val) {
      if (val && val.Movies) {
        // Merge all the movies into one array
        for (var i = 0; i < val.Movies.length; i++) {
          movie_data.push(val.Movies[i]);
        }
      }
    });

    //Filter the results to remove duplicates
    let output = movie_data.filter(function(v,i,a) {
      return i == a.findIndex(function(e) {
        return e.ID.replace(/^cw|^fw/, "") == v.ID.replace(/^cw|^fw/, "") // Removing cw/fw from string to make matching identical
      });
    });

    //Return the results back
    res.json(output);
  })
  .catch(function(e) {
    // Regardless of the internal error, it should return something to browser
    console.log(e);
    next();
  });
});

// Retrieve more details about a particular movie
app.get("/api/movie/:id", function(req, res, next) {
  // Handle for cwX or fwX
  let id = req.params.id.replace(/^cw|^fw/, "");

  // Retrieve data from the two sources
  let promises = [];
  promises.push(GetJSONDataFromURL("http://webjetapitest.azurewebsites.net/api/cinemaworld/movie/cw" + id));
  promises.push(GetJSONDataFromURL("http://webjetapitest.azurewebsites.net/api/filmworld/movie/fw" + id));

  // Collect all the data of the two movies returned
  Promise.all(promises).then(function(values) {
    let movie_data = [];
    // Retrieve all the movies found from the relevant APIs
    values.forEach(function(val) {
      if (val) {
        // Create an object to be returned to the browser with the relevant information
        let o = {
          Title: val.Title,
          Source: (val.ID.match(/^cw/)) ? "Cinemaworld" : (val.ID.match(/^fw/)) ? "Filmworld" : "Unknown",
          ID: val.ID,
          Price: val.Price
        };

        movie_data.push(o);
      }
    })

    // Return the results back
    res.json(movie_data);
  })
  .catch(function(e) {
    // Regardless of the internal error, it should return something to browser
    console.log(e)
    next();
  });
});

// Start the application
app.listen(3000, () => console.log("Hosting application on localhost:3000"));
