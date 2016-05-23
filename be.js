
const {r} = require('./dbConfig')
const {CreateKbz, Pulse}  = require('./pulse')

exports.CreateKbz = CreateKbz

exports.CreateUser = (userObj) =>{
    userObj.memberships = {live : {}, past : {}};
    return r.table('users').insert(userObj,{returnChanges : true})
    .then((user)=> Promise.resolve({KBZ : 'users' , id : user.generated_keys[0], obj: user.changes[0].new_val, desc : "New User has been Created" }),
          (err) => Promise.reject(new Error("err in CreateUser:" + err)))
    };

exports.CreateProposal = (KBZ, initiator, body, type, fid, uniq) => {
    console.log("in CreateProposal:" , body, type, fid, uniq)
    var Proposal = {};
    Proposal.initiator = initiator;
    Proposal.body = body;
    Proposal.proposalStatus = 3;
    Proposal.type = type;
    Proposal.log = [];
    Proposal.age = 0;
    Proposal.support = {
        "count": 0,
        "percent": 0,
        "members": []
    };
    Proposal.votes = {
        "pro": 0,
        "against": 0,
        "members": []
    };
    Proposal = Object.assign({},Proposal,uniq);
      console.log("in CreateProposa2:" ,Proposal.id) 
    return r.table(KBZ).insert(Proposal).run()
        .then((data) => {
            var proposal_id = data.generated_keys[0],
                p = Promise.resolve({id : data.generated_keys[0]})
                p1 = Promise.resolve({}),
                p2 = Promise.resolve({}),
                p3 = Promise.resolve({})                
            if(fid) {p1 = r.table(KBZ).get(fid).update({proposals : r.row('proposals').append(proposal_id)}).run()}
            if(initiator) {p2 = r.table(KBZ).get(initiator).update({ownProposals : r.row('ownProposals').append(proposal_id)}).run()}
            //if(type === 'CV') {p3 = r.table(KBZ).get(variables).update((variables) => variables.merge(r.object(type ,r.object ('proposals' , proposal_id))))}
            return Promise.all([p,p1,p2]) 
        }).then((xxx) => Promise.resolve({KBZ : KBZ, id : xxx[0].id, desc : "New Proposal had been Created"}),
                (err) => Promise.reject(new Error("Err in CreateProposal" + err)))
    };


exports.Support = (KBZ, proposal_id, member_id) => {
    console.log("support1:",KBZ, proposal_id, member_id)

    var p1 = r.table(KBZ).get('TheKbzDocument').pluck('size' , {'pulses' : ["Assigned"]})
        p2 = r.table(KBZ).get('variables')('ProposalSupport')('value')
        return Promise.all([p1,p2]).then((data)=> {
            var size = data[0].size,
                pulse = data[0].pulses.Assigned,
                ProposalSupport = data[1]
                //console.log("support2:",size,pulse,ProposalSupport)
                return r.table(KBZ).get(proposal_id).update(function (proposal) {
                    return r.branch(proposal('proposalStatus').ne(3),proposal,
                           proposal.merge(r.branch(proposal('support')('members').offsetsOf(member_id).isEmpty(),
                           {support : {
                                        count : proposal('support')('count').add(1),
                                        percent : proposal('support')('count').add(1).div(r.expr(size)).mul(100),
                                        members : proposal('support')('members').setInsert(member_id)
                                    }},
                                     {support : {
                                        count : proposal('support')('count').sub(1),
                                        percent : proposal('support')('count').sub(1).div(r.expr(size)).mul(100),
                                        members : proposal('support')('members').difference([member_id])
                                    }})))

                },{ returnChanges : true }).run().then((P) => {
                    var proposal = P.changes[0].new_val;
                    console.log("support3:", proposal.support.percent , ProposalSupport, proposal.support.percent < ProposalSupport)
                        if(P.changes === []) return P;
                        var proposal = P.changes[0].new_val;
                        if (proposal.support.percent < ProposalSupport ) return Promise.resolve({KBZ : KBZ, id : proposal_id ,desc : 'proposal just got supported'})
                            else return AssignetoPulse(KBZ, proposal_id, data[0].pulses.Assigned).then(()=> Promise.resolve({KBZ : KBZ, id : proposal_id ,desc : 'proposal was assigned to the next pulse'}));
                    })             
        }).then((ret) => ret, (err) => new Error("Error in support function: " + err))
    }


const AssignetoPulse = (KBZ, proposal_id, pulse_id) => {
    console.log("In AssignetoPulse", proposal_id,pulse_id);
    return Promise.all([
        r.table(KBZ).get(proposal_id).update({proposalStatus : 4}).run(),
        r.table(KBZ).get(pulse_id).update({Assigned : r.row('Assigned').setInsert(proposal_id)}).run()
        ]).then((d) => d, (d)=>{console.log("err:",d)})
};

exports.pulseSupport = (KBZ, member_id) => {
        return r.table(KBZ).get('variables')('PulseSupport')('value').then((PulseSupport)=> {
            return r.table(KBZ).get('TheKbzDocument').update(function (kbz) {   
                        return kbz.merge(r.branch(kbz('pulsesupport')('members').offsetsOf(member_id).isEmpty(),
                           {pulsesupport : {
                                        count : kbz('pulsesupport')('count').add(1),
                                        percent : kbz('pulsesupport')('count').add(1).div(kbz('size')).mul(100),
                                        members : kbz('pulsesupport')('members').setInsert(member_id)
                                    }}, 
                                     {pulsesupport : {
                                        count : kbz('pulsesupport')('count').sub(1),
                                        percent : kbz('pulsesupport')('count').sub(1).div(kbz('size')).mul(100),
                                        members : kbz('pulsesupport')('members').difference([member_id])
                                    }}))
                            },{ returnChanges : true }).run().then((P) => {
                            var kbz = P.changes[0].new_val;
                            console.log("pulse support:",kbz.pulsesupport.percent < PulseSupport,kbz.pulsesupport.percent )
                            if (kbz.pulsesupport.percent < PulseSupport) return Promise.resolve({KBZ : KBZ, id : kbz ,desc : 'Pulse just got supported'})
                                else return Pulse(KBZ).then(()=> Promise.resolve({KBZ : KBZ, id : kbz ,desc : 'Pulsing!!!'}));
              })             
            }).then((ret) => ret, (err) => new Error("Error in pulseSupport function: " + err))
    }


exports.vote = (KBZ, proposal_id, member_id, vote) => {
    //console.log("vote param:",KBZ, proposal_id, member_id, vote)
    var pro = 0,
        against = 0;
    if (vote === 1) pro = 1
        else against = 1;
    return r.table(KBZ).get(proposal_id).update(function (proposal) {
        return r.branch(proposal('proposalStatus').ne(6),proposal,
        proposal.merge(r.branch(proposal('votes')('members').offsetsOf(member_id).isEmpty(),
            {votes : {
                pro : proposal('votes')('pro').add(pro),
                against : proposal('votes')('against').add(against),
                members : proposal('votes')('members').setInsert(member_id)
            }},
            {}
            )))}).run().
    then(()=> Promise.resolve({KBZ : KBZ, id : proposal_id ,desc : 'voted!!!'}), (err) => new Error("Error in vote function: " + err))
    }


exports.comment = () => {}
