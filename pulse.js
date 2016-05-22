/*-------DB Functions------*/


import r from dbConfig.js

const randomKbzId = () => {
    var d = new Date().getTime();
    var uuid = 'KBZxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random()*16)%16 | 0;
        d = Math.floor(d/16);
        return (c=='x' ? r : (r&0x3|0x8)).toString(16);
    });
    return uuid;
};

const CreateStatement = (KBZ, statement, proposal_id) => {
    if (!KBZ || !statement || !proposal_id) return Promise.reject(new Error ("CreateStatement wrong parameters:" + statement + " : " + proposal_id));
    var statement = {dtype : 'statement',
                    statement : statement,
                    statementStatus : 1,    
                    proposals : [proposal_id]
                    };
    return r.table(KBZ).insert(statement).run()
        .then((st) => {return Promise.resolve({KBZ : KBZ, id : st.generated_keys[0], desc : "New Statement has been Created"})},
             (err) => {return Promise.reject(new Error ("Error in CreateStatement :" + err))});
};


const CancelStatement = (KBZ, id, proposal_id) => {
    return r.table(KBZ).get(id).update({statementStatus : 2, proposals : r.row('proposals').append(proposal_id)}).run()
        .then(() => {return Promise.resolve({KBZ: KBZ, id : id, desc : "Statement had been Canceled"})},
             (err) => {return Promise.reject(new Error ("Error in CancelStatement :" + err))});    
}

const ReplaceStatement = (KBZ,oldId,statement,proposal_id) =>{
    p1 = CancelStatement(KBZ,oldId,proposal_id)
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
const ChangeVariable = (KBZ, variableName, newValue, proposal_id) => {
    return r.table(KBZ).get('variables')(variableName)
        .then((data)=>{
            console.log("in ChangeVariable: data: ",data)
            r.table(KBZ).get(proposal_id).update({'oldValue' : data.value})
            data.value = newValue;
            data.proposals.push(proposal_id);
            return r.table(KBZ).get('variables').update(r.object(variableName, data)).run()
                .then(() => {return Promise.resolve({KBZ : KBZ, id : variableName, desc : "Variable had been Updated"})},
                     (err) => {return Promise.reject(new Error ("Error in ChangeVariable :" + err))});          
        })
}

const CreatePulse = (KBZ) =>{
    var pulse = {};
    pulse.pulseStatus = 1; 
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


export const CreateKbz = (PARENT, proposal_id, name, invitetions) => { 
console.log("in CreateKbz:",PARENT, proposal_id, name)   
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
        kbz.kbzid = tableName;
        return r.tableCreate(tableName).run().then(()=>{
            return r.table(tableName).insert([kbz,variables]).run()
                .then(() => {
                    var p1 = CreatePulse(tableName),
                        p2 = Promise.resolve({})
                    if (PARENT === 'users') {
                        p2 = Promise.all(invitetions.map((invite) =>  CreateMember(tableName, 'users', invite.id, 0, invite)))
                        .then((d) => d, (err)=> {console.log(err)})
                    }

                    return Promise.all([p1,p2]).then(() => tableName);
                });
        }).then((tableName) => Promise.resolve({KBZ : tableName , id : tableName , desc : "New KBZ has been Created"}), 
               (err) => Promise.reject(new Error("err in CreateKbz:" + err)))           
}



const CreateMember = (KBZ, PARENT, parent_member, proposal_id, userObj) => {
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



const CreateAction = (PARENT, proposal_id, action_name) => {
    return CreateKbz(PARENT, 0, proposal_id, action_name)
        .then((data) => {
            console.log('action_id',data.id);
            return r.table(PARENT).get('TheKbzDocument').update({'actions' : {'live' : r.row('actions')('live').merge(r.object(data.id , 1))}}).run()
                .then(() => Promise.resolve({KBZ : data.id ,id : data.id ,desc : "New Action Was Created:"+data.id}),
                (err) => Promise.reject(new Error ("err in CreateAction:",err)))})
    };


const RemoveMember = (KBZ, member_id, proposal_id) => {
    console.log("enetr RM with",KBZ,member_id)
    return r.table(KBZ).get(member_id).update(
        {
            memberStatus : 2,
            proposals : proposal_id ? r.row('proposals').append(proposal_id) : [0]
        },{ returnChanges : true }).run()
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


const RemoveAction = (ACTION,proposal_id) => {
    return r.table(ACTION).get('TheKbzDocument').update(
        {   kbzStatus : 2,
            proposals : r.row('proposals').append(proposal_id)
        },{ returnChanges : true }).run()
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


const CreateActionMember = (ACTION, KBZ, member_id, proposal_id, userObj) => {
        console.log("cacaca:",ACTION, KBZ, member_id, proposal_id, userObj)
        if (!ACTION || !KBZ) return Promise.reject(new Error("CreateActionMember: no action"));
        return CreateMember(ACTION,KBZ,member_id,proposal_id, userObj)
    };

const RemoverActionMember = (PARENT, member_id, proposal_id, userObj) => {
    return CreateProposal(PARENT, 0 ,'RA', member_id, Object.Assign({},usreObj,{proposal : proposal_id}));
} 

const AssignetoPulse = (KBZ, proposal_id, pulse_id) => {
    console.log("In AssignetoPulse", proposal_id,pulse_id);
    return Promise.all([
        r.table(KBZ).get(proposal_id).update({proposalStatus : 4}).run(),
        r.table(KBZ).get(pulse_id).update({Assigned : r.row('Assigned').setInsert(proposal_id)}).run()
        ]).then((d) => d, (d)=>{console.log("err:",d)})
};


var PulseOnTheAir = (KBZ, pulse_id, variables) => {
    console.log("IN PulseOnTheAir", pulse_id);
    return r.table(KBZ).get(pulse_id)
        .then((OnTheAir) => {
            OnTheAir.pulseStatus = 3;
            if (!OnTheAir.OnTheAir[0]) return r.table(KBZ).get(pulse_id).update(OnTheAir).run();
            return ExecuteOnTheAir(KBZ, OnTheAir, variables)
    })
}        


var ExecuteOnTheAir = (KBZ, OnTheAir, variables) => {
    //console.log("ExecuteOnTheAir",OnTheAir)

    return Promise.all(OnTheAir.OnTheAir.map((proposal_id) =>
        r.table(KBZ).get(proposal_id).then((proposal)=>{
            var variable = variables[proposal.type],
                p1 = Promise.resolve({KBZ : KBZ, id : proposal_id, desc : "proposal "+proposal_id+" rejected"})
            //console.log("ExecuteOnTheAir variable:",variable)                
            console.log("IN ExecuteOnTheAir proposal4:", proposal.votes, variable.value,proposal.votes.pro / (proposal.votes.against + proposal.votes.pro) * 100 >= variable.value);
            if (proposal.votes.pro / (proposal.votes.against + proposal.votes.pro) * 100 >= variable.value) {
                OnTheAir.Approved.push(proposal_id)
                proposal.proposalStatus = 7  /* Approved */
                p1 =  Execute(KBZ, proposal)
            }
                else {
                    OnTheAir.Rejected.push(proposal_id)
                    proposal.proposalStatus = 8 /*rejected*/
                }
            //console.log("ExecuteOnTheAir proposal:",proposal)                    
            var p2 = r.table(KBZ).get(proposal_id).update(proposal).run()
        
            return Promise.all([p1,p2])//.then((d) => {console.log("-----------:",d); return d[0]})
        },(err) => console.log("souldex:",proposal_id,err))
        )
    ).then((exec)=> { r.table(KBZ).get(OnTheAir.id).update(OnTheAir).run()
                      return exec
                  })
}


var Execute = function(KBZ, proposal) {
    console.log("executing proposal type: ", proposal.type);
    var p1 = Promise.resolve({})
    if (proposal.type === "ME") {p1 = CreateMember(KBZ, proposal.parent ,proposal.parent_member, proposal.id, proposal.userObj)}
     
    if (proposal.type === "NS") {p1 = CreateStatement(KBZ, proposal.statement, proposal.id)}

    if (proposal.type === "CS") {p1 = CancelStatement(KBZ , proposal.statement_id, proposal.id)}

    if (proposal.type === "RS") {p1 = ReplaceStatement(KBZ , proposal.statement_id, proposal.statement, proposal.id)}

    if (proposal.type === "CV") {p1 = ChangeVariable(KBZ , proposal.variableName, proposal.newValue, proposal.id)}

    if (proposal.type === "CA") {p1 = CreateAction(KBZ, proposal.id, proposal.actionName)}

    if (proposal.type === "AM") {p1 = CreateActionMember(proposal.action_id, KBZ, proposal.member_id, proposal.id, proposal.userObj)}

    if (proposal.type === "RM") {p1 = RemoveMember(proposal.action_id, KBZ, proposal.member_id, proposal.id, proposal.userObj)}

    if (proposal.type === "RA") {p1 = RemoveAction(proposal.action_id, proposal.actionName)}     

    if (proposal.type === "RAM") {p1 = RemoveActionMember(proposal.action_id, proposal.member_id, proposal.id, proposal.userObj)}          
    return p1
};

export const Pulse = (KBZ) => {
    var p1 = r.table(KBZ).get('TheKbzDocument')
        p2 = r.table(KBZ).get('variables')
    return Promise.all([p1,p2]).then((data) =>{
        var variables = data[1],
            tkd = data[0]
        console.log("pulse!:",data[1].id,tkd.pulses)
        if(!tkd.pulses.Assigned || !variables.id) return Promise.reject({err : new Error("can not get initail data in Pulse")})
        var p1 = Promise.resolve({})
        if(tkd.pulses.OnTheAir) { p1 = PulseOnTheAir(KBZ, tkd.pulses.OnTheAir, variables) }  
        var p2 = r.table(KBZ).get(tkd.pulses.Assigned).then((Assigned)=>{
            //console.log("tkd.pulses.Assigned:",tkd.pulses.Assigned,Assigned)
                if (Assigned.Assigned.length > 0 ) r.table(KBZ).getAll(... Assigned.Assigned).update({proposalStatus : 6}).run()
                console.log("pulse p3 :",Assigned)
                Assigned.pulseStatus = 2
                Assigned.OnTheAir = Assigned.Assigned
                Assigned.Assigned = []
                var p2 = r.table(KBZ).get(Assigned.id).replace(Assigned).run()
                return p2 //Promise.all([p1,p2])
                }),
            p3 = r.table(KBZ).filter({proposalStatus : 3}).update({age : r.row('age').add(1)}).run().then(()=>{
                console.log("pulse p35 :",variables.MaxAge.value)
                return r.table(KBZ).filter(r.row("proposalStatus").eq(3).and(r.row('age').gt(variables.MaxAge.value))).update({proposalStatus : 2}).run()
                }),
            p5 = r.table(KBZ).filter({memberStatus : 1}).update({age : r.row('age').add(1)}).run(),
                            
            p4 = CreatePulse(KBZ).then((pulse)=> {
                        tkd.pulses.Past.push(tkd.pulses.OnTheAir)
                        tkd.pulses.OnTheAir = tkd.pulses.Assigned
                        tkd.pulses.Assigned = pulse.id
                        tkd.pulsesupport = {
                            count: 0,
                            members: [],
                            percent: 0
                        };
                        console.log("pulse p4 :",tkd.pulses)
                        return r.table(KBZ).get('TheKbzDocument').update(tkd).run()
                })
   
        return Promise.all([p1,p2,p3,p4,p5])
    })
}
