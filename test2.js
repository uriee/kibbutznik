/*-------DB Functions------*/

var r = require('rethinkdbdash')({
    port: 28015,
    host: 'localhost',
    db: 'Kibbutznik'
});

var kbzname = 'KBZbb2b7593b4d14af63d2b425502b99', membername = 'uririru';

r.db('Kibbutznik').table('KBZe798d78114d9588e7e11660532221').get('acf3ab18-c4e4-4db9-96ae-ac4e939350cf').update({memberships : {live : r.row('memberships')('live').merge(r.object(kbzname,membername))}}).run()
.then((data) => {
    console.log(data);
});

/*
r.db('Kibbutznik').table('KBZe798d78114d9588e7e11660532221').get('acf3ab18-c4e4-4db9-96ae-ac4e939350cf').update({memberships :{'live' : r.literal(r.row('memberships')('live').without(kbzname))}})
.run()
.then((data,err) => {
    console.log(data,err);
});
*/
/*
r.db('Kibbutznik').table('users').get('6a7675e5-bbf7-4282-9bec-0fd689c4c0b6').update({memberships : r.literal(r.row('memberships').without(kbzname))})
.run()
.then((data,err) => {
    console.log(data,err);
});
*/
/*
r.db('Kibbutznik').table('users').get('6a7675e5-bbf7-4282-9bec-0fd689c4c0b6').update((data)=> {
	console.log("in:",data,data.memberships)
	data.uri = 50;
	return data
})
.then((data) => {
    console.log("out:",data);
    return data
}).error((err)=> {
	console.log("err:",err)
	return err
})
*/;