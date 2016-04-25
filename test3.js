/*-------DB Functions------*/

var r = require('rethinkdbdash')({
    port: 28015,
    host: 'localhost',
    db: 'Kibbutznik'
});

var randomKbzId = () => {
    var d = new Date().getTime();
    var uuid = 'KBZxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random()*16)%16 | 0;
        d = Math.floor(d/16);
        return (c=='x' ? r : (r&0x3|0x8)).toString(16);
    });
    return uuid;
};

var CreateStatement = (KBZ, statement, proposal_id) => {
    if (!KBZ || !statement || !proposal_id) return Promise.reject(new Error ("CreateStatement wrong parameters"));
    var statement = {dtype : 'statement',
                    statement : statement,
                    StatementStatus : 1,    /*Need to add Index on StatementStatus*/
                    proposals : [proposal_id]
                    };
    return r.table(KBZ).insert(statement).run()
        .then((st) => {return Promise.resolve({KBZ : KBZ, id : st.generated_keys[0], desc : "New Statement has been Created"})},
             (err) => {return Promise.reject(new Error ("Error in CreateStatement :" + err))});
};


var CancelStatement = (KBZ, id, proposal_id) => {
    return r.table(KBZ).get(id).update({StatementStatus : 2},{proposals : r.row('proposals').append(proposal_id)}).run()
        .then(() => {return Promise.resolve({KBZ: KBZ, id : id, desc : "Statement had been Canceled"})},
             (err) => {return Promise.reject(new Error ("Error in CancelStatement :" + err))});    
}

var ReplaceStatement = (KBZ,oldId,statement,proposal_id) =>{
    p1 = CancelStatement(KBZ,oldId)
    p2 = CreateStatement(KBZ,statement,proposal_id)
    return Promise.all([p1,p2]).then((data)=>{
        return Promise.resolve(data[1])
    })
}


/* Atomic Version
var ChangeVariable = (KBZ, variableName, newValue, proposal_id) => {
    return r.table(KBZ).get('variables').update(
        {r.row(variableName)('value') : newValue},
        {r.row(variableName)('proposals') : r.row(variableName)('proposals').append(proposal_id)}
        ).then(() => {return Promise.resolve({KBZ : KBZ, id : variableName, desc : "Variable had been Updated"})},
            (err) => {return Promise.reject(new Error ("Error in ChangeVariable :" + err))});  
}
*/

var ChangeVariable = (KBZ, variableName, newValue, proposal_id) => {
    return r.table(KBZ).get('variables')(variableName).run()
        .then((data)=>{
            data.value = newValue;
            data.proposals.push(proposal_id);
            return r.table(KBZ).get('variables').update(r.object(variableName, data)).run()
                .then(() => {return Promise.resolve({KBZ : KBZ, id : variableName, desc : "Variable had been Updated"})},
                     (err) => {return Promise.reject(new Error ("Error in ChangeVariable :" + err))});          
        })
}


var CreatePulse = (KBZ) =>{
    var pulse = {};
    pulse.PulseStatus = 1; 
    pulse.Assigned = [];
    pulse.OnTheAir = [];
    pulse.Approved = [];
    pulse.Rejected = [];
    return r.table(KBZ).insert(pulse).run()
            .then((data) => {
                return r.table(KBZ).get('TheKbzDocument').update({'pulses' : {'Assigned': data.generated_keys[0]}}).run()
                    .then(() => {return Promise.resolve({KBZ: KBZ, id : data.generated_keys[0] , desc : "New Pulse Has Been Created"})},
                     (err) => {return Promise.reject(new Error ("Error in CreatePulse :" + err))});
        })
   
};


var CreateKbz = (PARENT, proposal_id, name, invitetions) => { 
    var kbz = {id : 'TheKbzDocument',
                parent : PARENT,
                status : 1,
                actions : {
                    live: {},
                    past: {}
                    },
                kbzStatus : 1,
                size : 0,
                pulsesupport : {
                    members: [],
                    percent : 0,
                    count: 0
                    },
                pulses : {
                    Assigned: null,
                    OnTheAir: null,
                    Past: []
                    },
            };
    var variables = {id : 'variables'};

        kbz.proposals = (proposal_id ? [proposal_id] : []);
        r.table('variables').run()
            .then((data) => {
                data.forEach((variable) => {
                    variables[variable.id] = {
                        desc : variable.desc,
                        name : variable.name,
                        value: (variable.id === 'Name' ? name || 'No Name' :  variable.value),
                        proposals : []
                    }
                });
        });    
        var tableName = randomKbzId();
        return r.tableCreate(tableName).run().then(()=>{
            return r.table(tableName).insert([kbz,variables]).run()
                .then(() => {
                    var p1 = CreatePulse(tableName),
                        p2 = Promise.resolve({}),
                    if (PARENT === 'users') {
                        p2 = Promise.all(invitetions.map((invite) =>  CreateMember(tableName, 'users', invite.id, 0, invite)))
                    }

                    return Promise.all([p1,p2]).then(() => tableName);
                });
        }).then((tableName) => Promise.resolve({KBZ : tableName , id : tableName , desc : "New KBZ has been Created"}), 
               (err) => Promise.reject(new Error("err in CreateKbz:" + err)))           
}



var CreateMember = (KBZ, PARENT, parent_member, proposal_id, userObj) => {
    if (!KBZ) return Promise.reject(new Error ("CreateMember wrong parameters"));
    var Member = {};
    Member.parent_member = parent_member;
    Member.PARENT = PARENT;
    Member.proposals = (proposal_id ? [proposal_id] : []);
    Member.ownProposals = []
    Member.userObj = userObj;
    Member.memberships = {
        live : {},
        past : {}
    };
    Member.memberStatus = 1;
    return r.table(KBZ).insert(Member)
        .then((member) => {
            var p1 =  r.table(PARENT).get(parent_member).update({memberships : {live : r.row('memberships')('live').merge(r.object(KBZ, member.generated_keys[0]))}}).run(),
                p2 =  r.table(KBZ).get('TheKbzDocument').update({size : r.row('size').add(1)}).run()
            return Promise.all([p1,p2])
                .then(()=> Promise.resolve({KBZ : KBZ , id : member.generated_keys[0], desc : "New Member has been Created" }),
                      (err) => Promise.reject(new Error("err in CreateMember:" + err)))
            })
};


var CreateUser = (userObj) =>{
    userObj.memberships = {};
    return r.table('users').insert(userObj)
    .then((user)=> Promise.resolve({KBZ : 'users' , id : user.generated_keys[0], desc : "New User has been Created" }),
          (err) => Promise.reject(new Error("err in CreateUser:" + err)))
    };



var CreateAction = (PARENT, proposal_id, action_name) => {
    return CreateKbz(PARENT, 0, proposal_id, action_name)
        .then((data) => {
            console.log('action_id',data.id);
            return r.table(PARENT).get('TheKbzDocument').update({'actions' : {'live' : r.row('actions')('live').merge(r.object(data.id , 1))}}).run()
                .then(() => Promise.resolve({KBZ : data.id ,id : data.id ,desc : "New Action Was Created:"+data.id}),
                (err) => Promise.reject(new Error ("err in CreateAction:",err)))})
    };


var RemoveMember = (KBZ, member_id, proposal_id) => {
    console.log("enetr RM with",KBZ,member_id)
    return r.table(KBZ).get(member_id).update(
        {
            memberStatus : 2,
            proposals : proposal_id ? r.row('proposals').append(proposal_id) : [0]
        },{ returnChanges : true })
        .then((data) => {
            if (data.replaced === 0 ) return Promise.reject(new Error("Thers no live member in:" + KBZ + " with the id:"+ member_id));            
            var member = data.changes[0].new_val;
            console.log("In RemoveMember:", member);
            var p1 =  r.table(member.PARENT).get(member.parent_member).update(
                {
                    memberships : {live : r.literal(r.row('memberships')('live').without(KBZ)), past : r.row('memberships')('past').merge(r.object(KBZ,member.id))}
   //                 memberships : {past : r.row('memberships')('past').merge(r.object(KBZ,member.id))}
                }).run()
            if (Object.keys(member.memberships.live).length === 0) return p1;/*.then(()=>{return member});*/

            var p2 =  Promise.all(Object.keys(member.memberships.live).map((son)=>{
                                     console.log("SON:",son)
                                     console.log("member.memberships.live.son:",member.memberships.live[son]);
                                     return RemoveMember(son, member.memberships.live[son],0)
                                 }));
            return Promise.all([p1,p2])

        }).then(() => Promise.resolve({KBZ : KBZ, id : member_id, desc : "Member:"+ member_id + " Was Removed in kbz:" + KBZ }),
                (err) => Promise.reject(new Error("Err in RemoveMember" + err)))
    };

var RemoverActionMember = (PARENT, member_id, proposal_id) => {
    CreateProposal(PARENT, 0, member_id, )
} 
var RemoveAction = (ACTION,proposal_id) => {
    return r.table(ACTION).get('TheKbzDocument').update(
        {   kbzStatus : 2,
            proposals : r.row('proposals').append(proposal_id)
        },{ returnChanges : true })
        .then((data) => {
            console.log(data);
            if (data.replaced === 0 ) return Promise.reject(new Error("Thers no live Action in:" + ACTION));            
            var action = data.changes[0].new_val;
            var p1 =  r.table(action.parent).get('TheKbzDocument').update(
                {
                    actions : {live : r.literal(r.row('actions')('live').without(ACTION)), past : r.row('actions')('past').merge(r.object(ACTION,2))}
                    //actions : {past : r.row('actions')('past').merge(r.object(ACTION,2))}
                }).run()

            if (Object.keys(action.actions.live).length === 0) return p1;

            var p2 =  Promise.all(Object.keys(action.actions.live).map((son)=>{
                console.log("SON:",son)
                return RemoveAction(son,1)
                }));
            return Promise.all([p1,p2])

        }).then(() => Promise.resolve({KBZ : ACTION, id : ACTION, desc : "action:"+ ACTION + " Was Removed"}),
                (err) => Promise.reject(new Error("Err in RemoveAction" + err)))
    };


var CreateActionMember = (ACTION, KBZ, member_id, proposal_id, userObj) => {
        if (!ACTION || !KBZ) return promise.reject(new Error("CreateActionMember: no action"));
        return CreateMember(ACTION,KBZ,member_id,proposal_id, userObj)
    };


var CreateProposal = (KBZ, initiator, body, type, fid, uniq) => {
    var Proposal = {};
    Proposal.initiator = initiator;
    Proposal.body = body;
    Proposal.status = "3";
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
   
    return r.table(KBZ).insert(Proposal).run()
        .then((data) => {
            console.log("date:",data)
            proposal_id = data.generated_keys[0];
            var p1 = r.table(KBZ).get(fid).update({proposals : r.row('proposals').append(proposal_id)}).run(),
                p2 = r.table(KBZ).get(initiator).update({ownProposals : r.row('ownProposals').append(proposal_id)}).run()
            return Promise.all([p1,p2]) 
        }).then((x) => {console.log(x); return Promise.resolve({KBZ : KBZ, id : proposal_id, desc : "New Proposal had been Created"})},
                (err) => Promise.reject(new Error("Err in CreateProposal" + err)))
    };



var AssignetoPulse = (KBZ, proposal_id, pulse_id) => {
    console.log("In AssignetoPulse", proposal_id,pulse_id);
    return Promise.all([
        r.table(KBZ).get(proposal_id).update({status : 4}).run(),
        r.table(KBZ).get(pulse_id).update({Assigned : r.row('Assigned').append(proposal_id)})
        ]).then((d)=>{console.log("data:",d)},(d)=>{console.log("err:",d)})
};

var Support = (KBZ, proposal_id, member_id) => {
    var p1 = r.table(KBZ).get('TheKbzDocument').pluck('size' , {'pulses' : ["Assigned"]})
        p2 = r.table(KBZ).get('variables')('ProposalSupport')('value')
        Promise.all([p1,p2]).then((data)=> {
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
                        if (proposal.support.percent < ProposalSupport) return Promise.resolve({KBZ : KBZ, id : proposal_id ,desc : 'proposal just got supported'})
                            else return AssignetoPulse(KBZ, proposal_id, data[0].pulses.Assigned).then(()=> Promise.resolve({KBZ : KBZ, id : proposal_id ,desc : 'proposal was assigned to the next pulse'}));
                    })             
        }).then((ret) => ret, (err) => new Error("Error in support function: " + err))
    }

var pulseSupport = (KBZ, member_id) => {
        r.table(KBZ).get('variables')('PulseSupport')('value').then((PulseSupport)=> {
            console.log("PulseSupport",PulseSupport)
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
                                        console.log("inupdate",P)
                            var kbz = P.changes[0].new_val;
                            if (kbz.pulsesupport.percent < PulseSupport) return Promise.resolve({KBZ : KBZ, id : kbz ,desc : 'Pulse just got supported'})
                                else return Pulse(KBZ).then(()=> Promise.resolve({KBZ : KBZ, id : kbz ,desc : 'Pulsing!!!'}));
              })             
            }).then((ret) => ret, (err) => new Error("Error in pulseSupport function: " + err))
    }

var Vote = (KBZ, proposal_id, member_id, vote) => {
    var pro = 0,
        against = 0;
    if (vote === 1) pro = 1
        else against = 1;
    console.log(pro,against);
    return r.table(KBZ).get(proposal_id).update(function (proposal) {
        return proposal.merge(r.branch(proposal('votes')('members').offsetsOf(member_id).isEmpty(),
            {votes : {
                pro : proposal('votes')('pro').add(pro),
                against : proposal('votes')('against').add(against),
                members : proposal('votes')('members').setInsert(member_id)
            }},
            {}
            ))}).run().then(()=> Promise.resolve({KBZ : KBZ, id : proposal_id ,desc : 'voted!!!'}), (err) => new Error("Error in vote function: " + err))
    }

var Pulse(KBZ) => {
    var p1 = r.table(KBZ).get(TheKbzDocument)
        p2 = r.table(KBZ).get('variables')
    return promise.all([p1,p2]).then((data) =>{
        var variables = data[1].variables,
            tkd = data[0],
            p1 = PulseOnTheAir(KBZ, tkd.pulses.OnTheAir, variables)
            p2 = r.table(KBZ).get(tkd.pulses.Assigned)('Assigned').then((Assigned)=>{
                var p1 = r.table(KBZ).getAll(Assigned.Assigned).update({proposalstatus : 6}).run()
                Assigned.status = 2
                Assigned.OnTheAir = Assigned.Assigned
                Assigned.Assigned = []
                var p2 = r.table(KBZ).get(Assigned.id).replace(Assigned).run()
                return Promise.all([p1,p2])
                }),
            p3 = r.table(KBZ).filter({proposalStatus : 2}).update({age : r.row(age).add(1)}).then(()=>{
                return r.table(KBZ).filter(r.row("proposalStatus").eq(2).and(r.row("age").gt(variables.MaxAge))).update({proposalStatus : 3})
                }),
            p4 = Promise.resolve(()=>{
                    tkd.pulses.Past.push(tkd.pulses.OnTheAir);
                    tkd.pulses.OnTheAir = tkd.pulses.Assigned;
                    tkd.pulsesupport = {
                        count: 0,
                        members: []
                    };
                    return r.table(KBZ).get(TheKbzDocument).update(tkd)
                })

        return Promise.all([p1,p2,p3,p4]).then(()=>{KBZ : KBZ,id : KBZ, desc : "Pulsed"},(err) => new Error("error in pulse"))
    })
}


var PulseOnTheAir = (KBZ, pulse_id, variables) => {
    console.log("IN PulseOnTheAir", pulse_id);
    return r.table(KBZ).get(pulse_id)
        .then((OnTheAir) => {
            OnTheAir.status = 3;
            if (!OnTheAir.OnTheAir[0]) return r.table(KBZ).get(pulse_id).update(OnTheAir);
            return ExecuteOnTheAir(KBZ, OnTheAir, variables)
};


var ExecuteOnTheAir = (KBZ, OnTheAir, variables) => {

    Execution = OnTheAir.map((proposal_id) =>
        r.table(KBZ).get(proposal_id).then((proposal)=>{
            var variable = variables[proposal.type],
                p1 = Promise.resolve({KBZ : KBZ, id : proposal_id, desc : "proposal "+proposal_id+" rejected"})
            console.log("IN ExecuteOnTheAir proposal4:", proposal.votes, variable.value);
            if (proposal.votes.pro / (proposal.votes.against + proposal.votes.pro) * 100 >= variable.value) {
                OnTheAir.Approved.push(proposal_id)
                OnTheAir.OnTheAir.filter((z)=> z != proposal_id)
                proposal.status = '7'  /* Approved */
                p1 =  Execute(KBZ, proposal)
            }
                else {
                    OnTheAir.Rejected.push(proposal_id)
                    proposal.status = '8' /*rejected*/
                }
            var p2 = r.table(KBZ).get(proposal_id).update(proposal)
            return Promise([p1,p2]).then((x)=> x[0]);
        })
    )
    Execution.push(r.table(KBZ).get(OnTheAir.id).update(OnTheAir))
    return Promise.all(Execution).then((d) => d,(err) =>  new Error('Error in ExecuteOnTheAir' + err))
}


var Execute = function(KBZ, proposal) {
    console.log("executing proposal type: ", proposal.type);
    var p1 = Promise.resolve({})
    if (proposal.type === "ME") {p1 = CreateMember(KBZ, proposal.parent ,Proposal.parent_member, proposal.id, proposal.userObj)}
     
    if (proposal.type === "NS") {p1 = CreateStatement(KBZ, proposal.statement, proposal.id)}

    if (proposal.type === "CS") {p1 = CancelStatement(KBZ , proposal.statement_id,proposal.id)}

    if (proposal.type === "RS") {p1 = ReplaceStatement(KBZ , proposal.statement_id, statement, proposal.id)}

    if (proposal.type === "CV") {p1 = ChangeVariable(KBZ , proposal.variableName, newValue, proposal.id)}

    if (proposal.type === "CA") {p1 = CreateAction(KBZ, proposal.id, proposal.actionName)}

    if (proposal.type === "AM") {p1 = CreateActionMember(proposal.action_id, KBZ, proposal.member_id, proposal.id, proposal.userObj)}

    if (proposal.type === "RM") {p1 = RemoveMember(proposal.action_id, KBZ, proposal.member_id, proposal.id, proposal.userObj)}

    if (proposal.type === "RA") {p1 = RemoveAction(proposal.action_id, proposal.actionName)}        
    return p1;
};


var InitiateVariables = () => {
 return r.table('variables').insert([{
        id :"PulseSupport",
            "type": "PUS",
            "name": "Pulse Support",
            "value": 50,
            "desc": "The precentage of members support nedded to execute a pulse.",
            "proposals": []
        },
        {id: "ProposalSupport",
            "type": "PS",
            "name": "Proposal Support",
            "value": 15,
            "desc": "The precentage of members support nedded to assiged a Proposal to a pulse.",
            "proposals": []
        },
        {id : "ChangeVariable" ,
            "type": "CV",
            "name": "Change Variable",
            "value": 50,
            "desc": "The precentage of members vote nedded for changing a Variable value.",
            "proposals": []
        },
        {id : "ME",
            "type": "ME",
            "name": "Membership",
            "value": 50,
            "desc": "The precentage of members vote nedded to grant Membership to a User.",
            "proposals": []
        },
        {id : "EM",
            "type": "EM",
            "name": "End Membership",
            "value": 60,
            "desc": "The precentage of members vote nedded to Revoke Membership to a User.",
            "proposals": []
        },
        {id : "NS",
            "type": "NS",
            "name": "New Statement",
            "value": 50,
            "desc": "The precentage of members vote nedded to accept a new Statement.",
            "proposals": []
        },
        {id : "CS",
            "type": "CS",
            "name": "Cancel Statement",
            "value": 60,
            "desc": "The precentage of members vote nedded to Cancel Statement.",
            "proposals": []
        },
        {id : "NA",
            "type": "NA",
            "name": "New Action",
            "value": 50,
            "desc": "The precentage of members vote nedded to accept a new Action.",
            "proposals": []
        },
        {id : "RS",
            "type": "RS",
            "name": "Replace Statement",
            "value": 60,
            "desc": "The precentage of members vote nedded to Replace Statement.",
            "proposals": []
        },
        {id : "CM",
            "type": "CM",
            "name": "Committee Member",
            "value": 50,
            "desc": "The precentage of members vote nedded for assigning a Member to an Action.",
            "proposals": []
        },
        {id : "MinCommittee",
            "type": "MinC",
            "name": "MinCommittee",
            "value": 2,
            "desc": "The Minimun size of an Action Committee.",
            "proposals": []
        },
        {id : "MaxAge",
            "type": "MaxAge",
            "name": "MaxAge",
            "value": 2,
            "desc": "The Maximim 'OutThere' Proposal Age (in Pulses).",
            "proposals": []
        },
        {id : "Name",
            "type": "Name",
            "name": "Name",
            "value": "No Name",
            "desc": "The Communitty Name.",
            "proposals": []
        },
        {id : "Status",
            "type": "Status",
            "name": "Status",
            "value": "Alive",
            "desc": "The Communitty Status.",
            "proposals": []
        }        
    ]).run()
}

/*-------------------------Tests--------------------------------------*/

var testStatement = (k) => {
    CreateStatement(k,"hel all",1).then((data)=>{
        ReplaceStatement(data.KBZ,data.id,"uuruuuri",2).then((da) => {
            CancelStatement(da.KBZ,da.id).then((d)=>{
                console.log('testStatement:', data,da,d);
            })
        })
    })    
}


var kbzHiarchyTest = ()=> {
    CreateKbz('users',0,0,'urisFirstKibbuts',[]).then((kbz)=>{
        console.log("kbz:",kbz)
        Promise.all([
        CreateMember(kbz.id,'users','6a7675e5-bbf7-4282-9bec-0fd689c4c0b6',1,{}),
        CreateMember(kbz.id,'users','5064efb8-c58f-4d5f-a275-391bc001a34b',1,{}),
        CreateMember(kbz.id,'users','7aa36f50-053a-47d3-8894-ac0fe8ce45ca',1,{})
        ]).then((members) => {
            console.log ("members:",members)
            return Promise.all([CreateAction(kbz.id,201,"first"), CreateAction(kbz.id,202,"second")]).then((actions)=>{
                console.log ("actions:",actions)
                Promise.all(actions.map((action)=>{
                    Promise.all([
                        CreateMember(action.id,kbz.id,members[0].id,301),
                        CreateMember(action.id,kbz.id,members[1].id,302
                            )                        
                        ])
                 }).then((pa)=> console.log("pa",pa),(err)=> console.log("err:",err))

                )})})}).catch((err)=> console.log("err:",err))
}

var pulseTeast = () => {
    var users = ['uri1,uri2,uri3,uri4,uri5,uri6'];
    users.map((username) => { return CreateUser({user_name : username, email : username+"@gmail.com", image : "http://phootoos/"+username+".jpg",age :56})})
    .then((users) => {
        CreateKbz('users',3,"PULSEtestKBZ",[users[0],users[1],users[2]])
        .then((kbz) => {
            
            var p1 = CreateProposal(kbz,users[4],"let me in","ME",users[4].id,{parent : 'users',parent_member : users[4].id}),
                p2 = CreateProposal(kbz,users[3],"let me in","ME",users[3].id,{parent : 'users',parent_member : users[3].id}),
                p3 = CreateProposal(kbz,users[4],"let me in","NS",users[4].id,{statement : 'hey benn trying to...'}),
        })
    })
}

//test();
//CreateKbz('users','78642460-3f7e-4e38-96ef-c9f8bb2ac0a6',3,'urisFirstKibbuts',[]).then((data)=>{console.log("kbz:",data)});
//CreateMember('KBZd651089ed4c8e987363d3dfc8385c','KBZbb2b7593b4d14af63d2b425502b99','e3e10417-e739-48f4-b365-cb5d42d34f0e',225,"e3e10417-e739-48f4-b365-cb5d42d34f0e");
//CreateUser({username : "uri2",email: "uri2@gmial.com"}).then((x)=>{console.log("good",x)}).error((x)=>{console.log("bad",x)});
//CreateAction('KBZbb2b7593b4d14af63d2b425502b99',190133,"FisreeetAction")
//CreateStatement(3',"letterebelight",112233);
//ChangeVariable('KBZe798d78114d9588e7e11660532221','CM',68);
//RemoveMember('KBZ5c1fe80144e70866c79c67b65bc4c','98aff937-f3a0-40f5-9368-970b2bff9558',564).then((d)=>{console.log("dd:",d)});
//RemoveAction('KBZ5c1fe80144e70866c79c67b65bc4c',217).then((d)=>{console.log("dd:",d)});
//CreateProposal('KBZ7f197e5bd4759816720de5ceef2d9','3a1c32bf-2979-4436-b5a8-cc128ca6c5b5',"my first body",'ME','3a1c32bf-2979-4436-b5a8-cc128ca6c5b5',{thisis : 'uniq'}).then((data)=> {console.log("out",data)});
//Support('KBZ7f197e5bd4759816720de5ceef2d9','413d081c-7b59-4494-9861-9820d0b62d07', '3a1c32bf-2979-4436-b5a8-cc128ca6c5b4')
//pulseSupport('KBZ7f197e5bd4759816720de5ceef2d9', 'uri')
//Vote('KBZ7f197e5bd4759816720de5ceef2d9', "d42a2239-9cc9-4908-ada3-777356fbdb05", 'uri3',0 ).then((x)=> console.log(x))