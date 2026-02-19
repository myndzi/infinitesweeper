module.exports = {
  apps : [{
    name   : "sweeper",
    script : "./server.js",
    watch : true,
    env : {
      PORT : 3030
    }
  }]
}
