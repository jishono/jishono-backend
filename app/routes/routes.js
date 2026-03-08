
module.exports = app => {
  const appController = require("../controllers/appController.js");
  const userController = require("../controllers/userController.js");
  const oppslagController = require("../controllers/oppslagController.js");
  const forslagController = require("../controllers/forslagController.js");
  const { auth } = require("../routes/auth.js")
  const admin = require("../routes/admin.js")
  const msg = require("../locale/msg.json")
  const rateLimit = require("express-rate-limit")

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 })

  var router = require("express").Router();

  router.get("/health", appController.getHealth);

  // jisho.no front og Discord
  router.get("/items/all", oppslagController.getAllItems);

  router.get("/suggestion_list", oppslagController.getSuggestionList);

  router.get("/example_sentences/:id", oppslagController.getExampleSentences);

  router.post("/conjugations/:id", oppslagController.getConjugations);

  router.get("/search/:query", oppslagController.searchDiscord);

  router.post("/words/:id/feedback",appController.postFeedback)

  router.post("/request-translation/", appController.postRequest)

  // Baksida
  router.get("/oppslag/ai", auth, forslagController.getAiOppslag)

  router.get("/oppslag/:id", auth, oppslagController.getOppslag);

  router.get("/oppslag/:id/kommentarer", auth, oppslagController.getKommentarer);

  router.get("/boyning/:id", auth, oppslagController.findBoyning);

  router.get("/search_baksida", auth, oppslagController.searchOppslag);

  router.put("/update/:id", auth, admin, oppslagController.oppdaterOppslag);

  router.get("/anbefalinger", auth, appController.getAnbefalinger)

  router.get("/requests", auth, appController.getRequests)

  router.post("/words/suggestions/new", auth, oppslagController.addWordSuggestion)

  router.get("/words/suggestions", auth, oppslagController.getAllWordSuggestions)

  router.get("/words/suggestions/:id", auth, oppslagController.getWordSuggestion)

  router.post("/words/suggestions/:id/accept", auth, admin, oppslagController.acceptWordSuggestion)

  router.post("/words/suggestions/:id/reject", auth, admin, oppslagController.rejectWordSuggestion)

  //Forslags-ruter
  router.post("/oppslag/:id/nytt_forslag", auth, forslagController.addForslag);

  router.get("/forslag", auth, forslagController.getAllForslag)

  router.get("/forslag/user/:user_id", auth, forslagController.getMyForslag)

  router.get("/forslag/:id", auth, forslagController.hentForslag)

  router.post("/oppslag/:id/kommentarer", auth, oppslagController.postOppslagKommentar)

  router.post("/forslag/:id/stem", auth, forslagController.stemForslag)

  router.post("/forslag/:id/godkjenn", auth, admin, forslagController.adminGodkjennForslag)

  router.post("/forslag/:id/rediger", auth, forslagController.redigerForslag)

  router.post("/forslag/:id/avvis", auth, admin, forslagController.avvisForslag)

  router.post("/forslag/:id/fjern", auth, forslagController.fjernForslag)

  // Bruker-ruter

  router.post("/logg_inn", authLimiter, userController.loggInn)

  router.post("/registrer", authLimiter, userController.registrerBruker)

  router.get("/bruker/:id", auth, userController.getBruker)

  router.post("/bruker/:id/oppdater", auth, userController.updateBrukerdata)

  router.post("/bruker/:id/sist_sett", auth, userController.updateLastSeen)

  router.get("/brukere", auth, admin, userController.getAllUsers)

  router.get("/pagevisits", auth, admin, appController.getPageVisits)

  // Andre app-ruter

  router.get("/statistikk/brukeroversettelser", appController.getBrukeroversettelser)

  router.get("/statistikk/oppslag", appController.getOppslagInfo)
  
  router.get("/statistikk/nye-oversettelser", appController.getNyeOversettelser)
  
  router.get("/statistikk/nye-forslag", appController.getNyeForslag)
  
  router.get("/statistikk/kommentarer", appController.getAntallKommentarer)
  
  router.get("/statistikk/oversatt-per-dag", appController.getOversattPerDag)

  router.get("/veggen/innlegg", auth, appController.hentVegginnlegg)
  
  router.get("/veggen/innlegg/:id", auth, appController.hentVegginnlegg)

  router.post("/veggen/nytt_innlegg", auth, appController.postNyttVegginnlegg)

  router.post("/veggen/innlegg/:id/endre", auth, appController.endreVegginnlegg)

  router.post("/veggen/innlegg/:id/delete", auth, appController.deleteVegginnlegg)

  router.get("/veggen/usette_innlegg", auth, appController.hentAntallUsetteVegginnlegg)

  router.use((err, req, res, next) => {
    console.error(req.method, req.path, err)
    res.status(500).send(msg.generell_error)
  })

  app.use('/', router);
};