module.exports = app => {
    const jisho = require("../controllers/jisho.controller.js");
  
    var router = require("express").Router();
  
    // Legg til helt nytt oppslag
    //router.post("/", jisho.create);
  
    // Vis alle oppslag og søk
    router.get("/search", jisho.searchOppslag);
  
    // Vis enkelt oppslag med all data
    router.get("/oppslag/:id", jisho.getOppslag);

    // Hent kommentarer for enkeltoppslag
    router.get("/kommentarer/:id", jisho.getKommentarer);

    // Hent bøyningsmønstre
    router.get("/boyning/:id", jisho.findBoyning);
  
    // Oppdater data om et oppslag
    router.put("/update/:id", jisho.update);
  

    router.post("/login", jisho.login)
  
    app.use('/', router);
  };