/****************************************************************************
ISC License

Copyright (c) 2025 Jean-Pierre Benoit

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.

*****************************************************************************
Signal K server plugin to send performance data to an Open API.

Features :
- Configurable connection parameters
  * sails config name
  * protocol
  * hostname
  * jwt
  * sending period

TODO :

*****************************************************************************/
const debug = require("debug")("signalk:signalk-perf-to-api")
const axios = require('axios')

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
		enum: ['config01 - Intermediate jib + Main',
		       'config02 - Intermediate jib + Main one reef',
		       'config03 - Genoa + Main',
		       'config04 - Small jib + Main',
		       'config05 - Small jib + Main one reef',
		       'config06 - Small jib + Main two reef',
		       'config07 - Storm jib + Main two reefs',
		       'config08 - Storm jib',
		       'config09 - Small jib',
		       'config99 - test API' ]
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
	    let tunix=Math.round(new Date())
	    let datetime=app.getSelfPath('navigation.datetime.value')
	    let timestamp=Date.parse(datetime)

	    if ((tunix-timestamp) < period * 1000) { // only send data if age of data < period

		// only send data if engine is stopped
		let enginestate = app.getSelfPath('propulsion.main.state.value')
		if (enginestate === 'started' || enginestate === undefined) {
		    return
		}

		let longitude=Number(app.getSelfPath('navigation.position.value.longitude')).toFixed(6)
		let latitude=Number(app.getSelfPath('navigation.position.value.latitude')).toFixed(6)
		let sog=(Number(app.getSelfPath('navigation.speedOverGround.value'))*1.94384).toFixed(1)
		let cog=(Number(app.getSelfPath('navigation.courseOverGroundTrue.value'))*(180/Math.PI)).toFixed()
		let stw=(Number(app.getSelfPath('navigation.speedThroughWater.value'))*1.94384).toFixed(1)
		let aws=(Number(app.getSelfPath('environment.wind.speedApparent.value'))*1.94384).toFixed(1)
		let awa=(Number(app.getSelfPath('environment.wind.angleApparent.value'))*(180/Math.PI)).toFixed()
		let hdt=(Number(app.getSelfPath('navigation.headingTrue.value'))*(180/Math.PI)).toFixed()
		let heel=(Number(app.getSelfPath('navigation.attitude.roll.value'))*(180/Math.PI)).toFixed()
		
		let configname = sailconfig.split(' - ')[0]

		// only send data if nothing is NaN
		if (isNaN(longitude) || isNaN(latitude) || 
		    isNaN(sog) ||
		    isNaN(cog) ||
		    isNaN(stw) ||
		    isNaN(awa) ||
		    isNaN(aws) ||
		    isNaN(hdt) ||
		    isNaN(heel)) {
		    return
		}
/*
// Données de test
		stw=5.,
		awa=45.,
		aws=10.
*/		

		const options = {
		    headers: {'Content-Type': 'application/json'}
		};

		var data = {
		    'configname': configname,
		    'fixtime': datetime,
		    'stw': stw,
		    'awa': awa,
		    'aws': aws,
		    'sog': sog,
		    'cog': cog,
		    'hdt': hdt,
		    'heel': heel,
		    'longitude': longitude,
		    'latitude': latitude
		}

		app.debug('data:', JSON.stringify(data,null,2));
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
