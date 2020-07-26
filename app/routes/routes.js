const forslagController = require("../controllers/forslagController.js");


module.exports = app => {
    const jisho = require("../controllers/jisho.controller.js");
    const appController = require("../controllers/appController.js");
    const userController = require("../controllers/userController.js");
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
  
    router.post("/logg_inn", jisho.loggInn)

    router.post("/registrer", jisho.registrer)

    router.get("/anbefalinger", auth, jisho.getAnbefalinger)

    //Forslags-ruter
    router.post("/forslag/:id", auth, forslagController.addForslag);

    router.get("/forslag", auth, forslagController.getAllForslag)

    router.post("/forslag/:id/stem", auth, forslagController.stemForslag)

    router.post("/forslag/:id/godkjenn", auth, admin, forslagController.adminGodkjennForslag)

    router.post("/forslag/:id/avvis", auth, admin, forslagController.avvisForslag)

    router.post("/forslag/:id/fjern", auth, forslagController.fjernForslag)


    // Bruker-ruter
    
    router.get("/bruker/:id", auth, userController.getBruker)

    router.get("/bruker/:id/forslag", auth, userController.getBrukerforslag)

    router.post("/bruker/:id/oppdater", auth, userController.updateBrukerdata)

    // Andre app-ruter

    router.get("/statistikk", auth, appController.getStatistikk)
  
    app.use('/', router);
  };