/*-------DB Functions------*/

var r = require('rethinkdbdash')({
    port: 28015,
    host: 'localhost',
    db: 'Kibbutznik'
});

const deletekbz = ()=>{
	r.tableList().then((list) =>{
		list.forEach((t)=> {
			console.log(t)
			if(t[0]==='K') r.tableDrop(t)
		})
	})
}
deletekbz();
