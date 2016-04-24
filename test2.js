/*-------DB Functions------*/

var r = require('rethinkdbdash')({
    port: 28015,
    host: 'localhost',
    db: 'Kibbutznik'
});
/*
r.table('KBZ7f197e5bd4759816720de5ceef2d9').get('413d081c-7b59-4494-9861-9820d0b62d07').update((proposal)=>{
console.log("proposal",proposal,proposal.support);
    return r.branch(
}).then((d)=>{console.log(d)},(d)=>{console.log(d)})
*/
var Support = (KBZ, proposal_id, member_id) => {
    var p1 = r.table(KBZ).get('TheKbzDocument').pluck('size' , {'pulses' : ["Assigned"]})
        p2 = r.table(KBZ).get('variables')('ProposalSupport')('value')
        Promise.all([p1,p2]).then((data)=> {
            console.log(data)
            var size = data[0].size,
                pulse = data[0].pulses.Assigned,
                ProposalSupport = data[1]
				return r.table(KBZ).get(proposal_id).update(function (proposal) {	
				    return proposal.merge(r.branch(proposal('support')('members').offsetsOf(member_id).isEmpty(),
				    	   {support : {
				                        count : proposal('support')('count').add(1),
				                        percent : proposal('support')('count').add(1).div(r.expr(size)).mul(100),
				                        members : proposal('support')('members').setInsert(member_id)
				                    }},
				                     {support : {
				                        count : proposal('support')('count').sub(1),
				                        percent : proposal('support')('count').sub(1).div(r.expr(size)).mul(100),
				                        members : proposal('support')('members').difference([member_id])
				                    }}))

				},{ returnChanges : true }).run().then((P) => {
                        var proposal = P.changes[0].new_val;
                        console.log("data: " + data,"proposal: ", P.changes[0].new_val);
                        if (proposal.support.percent < ProposalSupport) return Promise.resolve({KBZ : KBZ, id : proposal_id ,desc : 'proposal was assigned to the next pulse'})
                            else return AssignetoPulse(KBZ, proposal_id, data[0].pulses.Assigned).then(()=> Promise.resolve({KBZ : KBZ, id : proposal_id ,desc : 'proposal was assigned to the next pulse'}));
                    })             
        }).then((ret) => ret, (err) => new Error("Error in support function: " + err))
    }




/*
				.then((d)=>{console.log("d1:",d)},(d)=>{console.log(d)})
		}).then((d)=>{console.log("d2:",d)},(d)=>{console.log(d)})
}
*/
Support('KBZ7f197e5bd4759816720de5ceef2d9','413d081c-7b59-4494-9861-9820d0b62d07', '3a1c32bf-2979-4436-b5a8-cc128ca6c5b4')
/*var x = 'ur2i'
r.expr(['uri','uritest','uri1']).offsetsOf(x).isEmpty().then((d)=>{console.log(d)})
*/
/*
var kbzname = 'KBZbb2b7593b4d14af63d2b425502b99', membername = 'uririru';

r.table('KBZe798d78114d9588e7e11660532221').get('acf3ab18-c4e4-4db9-96ae-ac4e939350cf').update({memberships : {live : r.row('memberships')('live').merge(r.object(kbzname,membername))}}).run()
.then((data) => {
    console.log(data);
});


r.db('Kibbutznik').table('KBZe798d78114d9588e7e11660532221').get('acf3ab18-c4e4-4db9-96ae-ac4e939350cf').update({memberships :{'live' : r.literal(r.row('memberships')('live').without(kbzname))}})
.run()
.then((data,err) => {
    console.log(data,err);
});


r.db('Kibbutznik').table('users').get('6a7675e5-bbf7-4282-9bec-0fd689c4c0b6').update({memberships : r.literal(r.row('memberships').without(kbzname))})
.run()
.then((data,err) => {
    console.log(data,err);
});
*/
 //r.table('KBZ7f197e5bd4759816720de5ceef2d9').get('TheKbzDocument').pluck('size' , {'pulses' : ["Assigned"]}).then((size) => console.log(size));
/*
p1 = Promise.reject({uri : 10})
p2 = r.table('KBZe798d78114d9588e7e11660532221').get('acf3ab18-c4e4-4db9-96ae-ac4e939350cf')
p3 = r.table('KBZe798d78114d9588e7e11660532221').get('acf3ab18-c4e4-4db9-96ae-ac4e939350c0')
p4 = Promise.all([p1,p2,p3])
p4.then((x)=> console.log("x",x),(err) => {console.log("err",err)})
*/