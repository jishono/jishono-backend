

module.exports = app => {
    const jisho = require("../controllers/jisho.controller.js");
    const { auth } = require("../routes/auth.js")
    const admin = require("../routes/admin.js")
  
    var router = require("express").Router();
  
    // Legg til helt nytt oppslag
    //router.post("/", jisho.create);
  
    // Vis alle oppslag og søk
    router.get("/search", auth, jisho.searchOppslag);
  
    // Vis enkelt oppslag med all data
    router.get("/oppslag/:id", auth, jisho.getOppslag);

    // Hent kommentarer for enkeltoppslag
    router.get("/kommentarer/:id", auth, jisho.getKommentarer);

    // Hent bøyningsmønstre
    router.get("/boyning/:id", auth, jisho.findBoyning);
  
    // Oppdater data om et oppslag
    router.put("/update/:id", auth, admin, jisho.update);

    router.post("/forslag/:id", auth, jisho.addForslag);
  
    router.post("/logg_inn", jisho.loggInn)

    router.post("/registrer", jisho.registrer)

    router.get("/forslag", auth, jisho.getAllForslag)

    router.post("/forslag/:id/stem", auth, jisho.stemForslag)

    router.post("/forslag/:id/godkjenn", auth, admin, jisho.adminGodkjennForslag)
  
    app.use('/', router);
  };