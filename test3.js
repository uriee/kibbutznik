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


var CancelStatement = (KBZ,id) => {
    return r.table(KBZ).get(id).update({StatementStatus : 2}).run()
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

var ReplaceVariable = (KBZ, variableName, newValue) => {  
    return r.table(KBZ).get('variables')(variableName).run()
        .then((data)=>{
            data.value = newValue;
            return r.table(KBZ).get('variables').update(r.object(variableName, data)).run()
                .then(() => {return Promise.resolve({KBZ : KBZ, id : variableName, desc : "Variable had been Updated"})},
                     (err) => {return Promise.reject(new Error ("Error in ReplaceVariable :" + err))});          
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


var CreateKbz = (PARENT, member_id, proposal_id, name, invitetions) => { 
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
                    CreatePulse(tableName);
                    if (member_id) {
                        CreateMember(tableName, PARENT, member_id, proposal_id);
                    }

                    return tableName;
                });
        }).then((tableName) => Promise.resolve({KBZ : tableName , id : tableName , desc : "New KBZ has been Created"}), 
               (err) => Promise.reject(new Error("err in CreateKbz:" + err)))           
}



var CreateMember = (KBZ, PARENT, parent_member, proposal_id,user_id) => {
    if (!KBZ) return Promise.reject(new Error ("CreateMember wrong parameters"));
    var Member = {};
    Member.parent_member = parent_member;
    Member.PARENT = PARENT;
    Member.proposals = (proposal_id ? [proposal_id] : []);
    Member.user_id = (user_id ? user_id : parent_member);
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
    .then((user)=> Promise.resolve({KBZ : KBZ , id : user.generated_keys[0], desc : "New User has been Created" }),
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


var RemoveMember = (KBZ, member_id,proposal_id) => {
    console.log("enetr RM with",KBZ,member_id)
    return r.table(KBZ).get(member_id).update(
        {
            memberStatus : 2,
            proposals : proposal_id ? r.row('proposals').append(proposal_id) : 0
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


var CreateCommitteeMember = (ACTION, KBZ, member_id, proposal_id,user_id) => {
        if (!ACTION || !KBZ) return promise.reject(new Error("CreateCommitteeMember: no action"));
        return CreateMember(ACTION,KBZ,member_id,proposal_id,user_id)
    };

/*
var CreateProposal = function(KBZ, initiator, title, body, type, uniq) {
    var Proposal = {};
    Proposal.initiator = initiator;
    Proposal.title = title;
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

      if (type == "ME" || type == "EM") {
        Proposal.member_id = uniq.member_id;
    }
    if (type == "CS") {
        Proposal.statement_id = uniq.statement_id;
    }
    if (type == "NS") {
        Proposal.statement = uniq.statement;
    }
    if (type == "RS") {
        Proposal.statement_id = uniq.statement_id;
        Proposal.newstatement = uniq.newstatement;
        Proposal.oldstatement = uniq.oldstatement;
    }
    if (type == "CV") {
        Proposal.variable = uniq.variable;
        Proposal.newvalue = uniq.newvalue;
    }
    if (type == "NA") {
        Proposal.actionname = uniq.actionname;
    }
    if (type == "CM") {
        Proposal.member_id = uniq.member_id;
        Proposal.action_id = uniq.action_id;
    }
    db_insert(KBZ, Proposal)
        .then(function(proposal, err) {
            //console.log("in CreateProposal2",proposal,err);
            if (!(type == "ME")) {
                db_updateOne(KBZ, proposal.initiator, {
                    $push: {
                        "myproposals": proposal._id
                    }
                });
            }

            if (proposal.member_id) {
                db_updateOne(KBZ, proposal.member_id, {
                    $push: {
                        "proposals": proposal._id
                    }
                });
            }

            if (proposal.statement_id) {
                db_updateOne(KBZ, proposal.statement_id, {
                    $push: {
                        "proposals": proposal._id
                    }
                });
            }

            if (proposal.variable) {
                key = "variables." + proposal.variable + ".proposals";
                variable = {};
                variable[key] = proposal._id;
                db_updateOne(KBZ, 'TheKbzDocument', {
                    $push: variable
                });
            }

            if (proposal.action_id) {
                db_updateOne(KBZ, proposal.action_id, {
                    $push: {
                        "proposals": proposal._id
                    }
                });
            }

            if (err) d.reject(err);
            else d.resolve(proposal);
        });
    return d.promise;
};
*/

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


// test function


var testStatement = (k) => {
    CreateStatement(k,"hel all",1).then((data)=>{
        ReplaceStatement(data.KBZ,data.id,"uuruuuri",2).then((da) => {
            CancelStatement(da.KBZ,da.id).then((d)=>{
                console.log('testStatement:', data,da,d);
            })
        })
    })    
}

//testStatement('KBZbb2b7593b4d14af63d2b425502b99')

var test = ()=> {
    CreateKbz('users',0,0,'urisFirstKibbuts',[]).then((kbz)=>{
        console.log("kbz:",kbz)
        Promise.all([
        CreateMember(kbz.id,'users','6a7675e5-bbf7-4282-9bec-0fd689c4c0b6',1,'6a7675e5-bbf7-4282-9bec-0fd689c4c0b6'),
        CreateMember(kbz.id,'users','5064efb8-c58f-4d5f-a275-391bc001a34b',1,'5064efb8-c58f-4d5f-a275-391bc001a34b'),
        CreateMember(kbz.id,'users','7aa36f50-053a-47d3-8894-ac0fe8ce45ca',1,'7aa36f50-053a-47d3-8894-ac0fe8ce45ca')
        ]).then((members) => {
            console.log ("members:",members)
            return Promise.all([CreateAction(kbz.id,201,"first"), CreateAction(kbz.id,202,"second")]).then((actions)=>{
                console.log ("actions:",actions)
                Promise.all(actions.map((action)=>{
                    Promise.all([
                        CreateMember(action.id,kbz.id,members[0].id,301,members[0].id),
                        CreateMember(action.id,kbz.id,members[1].id,302,members[1].id)                        
                        ])
                 }).then((pa)=> console.log("pa",pa),(err)=> console.log("err:",err))

                )})})}).catch((err)=> console.log("err:",err))

}

//test();
//CreateKbz('users','78642460-3f7e-4e38-96ef-c9f8bb2ac0a6',3,'urisFirstKibbuts',[]).then((data)=>{console.log("kbz:",data)});
//CreateMember('KBZd651089ed4c8e987363d3dfc8385c','KBZbb2b7593b4d14af63d2b425502b99','e3e10417-e739-48f4-b365-cb5d42d34f0e',225,"e3e10417-e739-48f4-b365-cb5d42d34f0e");
//CreateUser({username : "uri2",email: "uri2@gmial.com"}).then((x)=>{console.log("good",x)}).error((x)=>{console.log("bad",x)});
//CreateAction('KBZbb2b7593b4d14af63d2b425502b99',190133,"FisreeetAction")
//CreateStatement(3',"letterebelight",112233);
//ReplaceVariable('KBZe798d78114d9588e7e11660532221','CM',68);
//RemoveMember('KBZ5c1fe80144e70866c79c67b65bc4c','98aff937-f3a0-40f5-9368-970b2bff9558',564).then((d)=>{console.log("dd:",d)});
RemoveAction('KBZ5c1fe80144e70866c79c67b65bc4c',217).then((d)=>{console.log("dd:",d)});
