const debug = require("debug")("signalk:signalk-perf-to-api");
const axios = require('axios')

/*

Signal K server plugin to send performance data to an Open API.

Features :
- Configurable connection parameters
  * hostname
  * port
  * sending period
  * sails config name

TODO:

*/

module.exports = function(app) {
    const plugin = {}
    var timerId
    var sailconfig
    
    plugin.id = "sk-perf-to-api"
    plugin.name = "Performance data Sender"
    plugin.description = "Send sailboat performance data to a database"

    plugin.schema = {
	type: "object",
	title: "Sailboat performance data post",
	description: "Post sailboat parameters to an api",
	properties: {
	    sailconfig: {
		type: 'string',
		title: 'Sails config',
		default: 'config01 - Intermediate jib + Main',
		enum: ['config01 - Intermediate jib + Main', 'config02 - Intermediate jib + Main one reef', 'config03 - Genoa + Main', 'config04 - Small jib + Main one reef', 'config05 - Small jib + Main two reef', 'config06 - Storm jib + Main two reefs', 'config07 - Storm jib' ]
	    },
	    protocol: {
		type: 'string',
		title: 'Protocol',
		default: 'http',
		enum: ['http','https']
	    },
	    hostname: {
		type: 'string',
		title: 'Host name / IP',
                default: 'api.localhost'
	    },
	    jwt: {
		type: 'string',
		title: 'JSON Web token',
		default: 'zob'
	    },
	    period: {
		type: 'number',
		title: 'Sending period (s)',
		default: 300
	    }
	}
    }

    const setStatus = app.setPluginStatus || app.setProviderStatus;

    plugin.start = function (options) {

	protocol=options.protocol
	hostname = options.hostname
	jwt=options.jwt
        period = options.period
	sailconfig = options.sailconfig

	if (typeof hostname === 'undefined') {
	    setStatus(`hostname not defined, plugin disabled`)
	    return
	}

	const url=protocol+'://'+hostname+"/perf/param/bycfgname?jwt="+jwt
	timerId = setInterval(() => { sendData(url) }, period * 1000 )
    }
    
    plugin.stop = function () {

	clearInterval(timerId)

    }
    return plugin

    function sendData(url) {
	try {
	    let tunix=Math.round(+new Date())
	    let datetime=app.getSelfPath('navigation.datetime.value')
	    let timestamp=Date.parse(datetime)

	    if ((tunix-timestamp) < period * 1000) { // only send data if age of data < period

		let enginestate = app.getSelfPath('propulsion.main.state.value')
		if (enginestate === 'started' || enginestate === undefined) { // only send data if engine is stopped
		    return
		}

		let longitude=Number(app.getSelfPath('navigation.position.value.longitude')).toFixed(6)
		let latitude=Number(app.getSelfPath('navigation.position.value.latitude')).toFixed(6)
		let sog=(Number(app.getSelfPath('navigation.speedOverGround.value'))*1.94384).toFixed(1)
		let cog=(Number(app.getSelfPath('navigation.courseOverGroundTrue.value'))*(180/Math.PI)).toFixed()
		let stw=(Number(app.getSelfPath('navigation.speedThroughWater.value'))*1.94384).toFixed(1)
		let aws=(Number(app.getSelfPath('environment.wind.speedApparent.value'))*1.94384).toFixed(1)
		let awa=(Number(app.getSelfPath('environment.wind.angleApparent.value'))*(180/Math.PI)).toFixed()
		let dbt=(Number(app.getSelfPath('environment.depth.belowKeel.value'))).toFixed(1)

		let configname = sailconfig.split(' - ')[0]
		let configdesc = sailconfig.split(' - ')[1]

		stw=5.
		awa=35.
		aws=10.
		dbt=17.3
		if (isNaN(stw) || isNaN(awa) || isNaN(aws) || isNaN(dbt)) {
		    return
		}
		
		const options = {
		    headers: {'Content-Type': 'application/json'}
		};

		var data = {
		    'configname': configname,
		    'fixtime': datetime,
		    'stw': stw,
		    'awa': awa,
		    'aws': aws,
		    'dbt': dbt,
		    'sog': sog,
		    'cog': cog,
		    'longitude': longitude,
		    'latitude': latitude,
		    'engine': enginestate
		}

		app.debug(`data:`, data);
		const postDataPoint = async () => {
		    try {
			const res = await axios.post(url, data, options)
			app.debug(`req.status: ${res.status}`)
		    } catch (error) {
			// Handle error
			console.error(error);
		    }
		}

		postDataPoint();

	    }

	} catch (err) {
	    console.log(err)
	}
    }
}
