
module.exports = app => {
    const appController = require("../controllers/appController.js");
    const userController = require("../controllers/userController.js");
    const oppslagController = require("../controllers/oppslagController.js");
    const forslagController = require("../controllers/forslagController.js");
    const { auth } = require("../routes/auth.js")
    const admin = require("../routes/admin.js")
  
    var router = require("express").Router();
  
    router.get("/search", auth, oppslagController.searchOppslag);
  
    router.get("/oppslag/:id", auth, oppslagController.getOppslag);

    router.get("/kommentarer/:id", auth, oppslagController.getKommentarer);

    router.get("/boyning/:id", auth, oppslagController.findBoyning);
  
    router.put("/update/:id", auth, admin, oppslagController.oppdaterOppslag);
  
    router.get("/anbefalinger", auth, appController.getAnbefalinger)

    //Forslags-ruter
    router.post("/oppslag/:id/nytt_forslag", auth, forslagController.addForslag);

    router.get("/forslag", auth, forslagController.getAllForslag)

    // Ikke i bruk
    /* router.get("/bruker/:id/forslag", auth, forslagController.getBrukerforslag) */

    router.get("/forslag/:id", auth, forslagController.hentForslag)
    
    router.get("/forslag/:id/kommentarer", auth, forslagController.getForslagKommentarer)

    router.post("/forslag/:id/ny_kommentar", auth, forslagController.postForslagKommentar)
    
    router.post("/forslag/:id/stem", auth, forslagController.stemForslag)

    router.post("/forslag/:id/godkjenn", auth, admin, forslagController.adminGodkjennForslag)

    router.post("/forslag/:id/rediger", auth, forslagController.redigerForslag)

    router.post("/forslag/:id/avvis", auth, admin, forslagController.avvisForslag)

    router.post("/forslag/:id/fjern", auth, forslagController.fjernForslag)

    // Bruker-ruter

    router.post("/logg_inn", userController.loggInn)

    router.post("/registrer", userController.registrerBruker)
    
    router.get("/bruker/:id", auth, userController.getBruker)

    router.post("/bruker/:id/oppdater", auth, userController.updateBrukerdata)

    router.post("/bruker/:id/sist_sett", auth, userController.updateLastSeen)

    // Andre app-ruter

    router.get("/statistikk", auth, appController.getStatistikk)

    router.get("/veggen/innlegg/:id", auth, appController.hentVegginnlegg)
    
    router.post("/veggen/nytt_innlegg", auth, appController.postNyttVegginnlegg)

    router.post("/veggen/innlegg/:id/endre", auth, appController.endreVegginnlegg)

    router.delete("/veggen/innlegg/:id/delete", auth, appController.deleteVegginnlegg)

    router.get("/veggen/usette_innlegg/", auth, appController.hentAntallUsetteVegginnlegg)
  
    app.use('/', router);
  };