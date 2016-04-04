/*-------DB Functions------*/

var r = require('rethinkdbdash')({
    port: 28015,
    host: 'localhost',
    db: 'Kibbutznik'
});

r.table("posts").get(1).update({status: "published"})

r.table("posts").insert({
    id: 1,
    title: "Lorem ipsum",
    content: "Dolor sit amet"
})

/*---LOGIC FUNCTIONS------*/
var randomKbzId = function() {
    var d = new Date().getTime();
    var uuid = 'KBZxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random()*16)%16 | 0;
        d = Math.floor(d/16);
        return (c=='x' ? r : (r&0x3|0x8)).toString(16);
    });
    return uuid;
};

var CreateStatement = function(KBZ, value, proposal_id) {
    if (!KBZ || !value || !proposal_id) console.error("CreateStatement parameters are not soficient");
    var statement = {dtype : 'statement',
                    statement : value,
                    StatemntStatus : 1    /*Need to add Index on StatemntStatus*/
                    proposals : [proposal_id]
                    };
    return r.table(KBZ).insert(statement).run()
};
r.CreateStatement('demo',"you are here",12);

var CreatePulse = function(KBZ) {
    var pulse = {};
    pulse.PulseStatus = 1; /*Need to add Index on PulseStatus*/
    pulse.Assigned = [];
    pulse.OnTheAir = [];
    pulse.Approved = [];
    pulse.Rejected = [];
    return r.table(KBZ).insert(pulse)
            .then(function(data, err) {
                if (err) d.reject(new Error('CreatePulse' + err));
                db_updateOne(KBZ, 'TheKbzDocument' {
                        $set: {
                         "pulses.Assigned": data._id
                     }
                })

        });

};

var createUser = function(userObj){
    CreateMember('outMost','',0,0,userObj).then(function(data,err){
        if(err) {console.log("cannot add user");}
        else confirmRegistration();
    });
};

var CreateMember = function(KBZ, PARENT, parent_member, proposal_id, userObj) {
    if (!(KBZ = 'outMost' or PARENT) throw "CreateMember parameter FAIL!";
    var d = Q.defer(),
        Member = {};
    Member.parent_member = parent_member;
    Member.PARENT = PARENT;
    Member.userObj = userObj;
    Member.proposals = (proposal_id ? [proposal_id] : []);
    Member.actions = {
        live: [],
        past: []
    };
    Member.memberStatus = 1;                     /*Need to add Index on MemberStatus*/
    db_insert(KBZ, Member)
        .then(function(member, err) {
            if (!member) d.reject(new Error("no member"));
            db_updateOne(PARENT, parent_member, {
                    $push: {
                        'memberships': [KBZ,member._id]
                    }
                })
                .then(db_updateOne(KBZ, 'TheKbzDocument' {
                    $inc: {
                        size: 1
                    }
                }))
                .then(function(data, err) {
                    if (err) d.reject(new Error('CreateMember' + err));
                    else d.resolve(member);
                });
        });
    return d.promise;
};

var CreateCommitteeMember = function(KBZ,ACTION, member_id, proposal_id) {
    console.log("In CreateCommitteeMember: ", ACTION, member_id, proposal_id);
    if (!ACTION) throw new Error("CreateCommitteeMember: no action");
    var d = Q.defer(),
        Member = {};
    Member.parent = member_id;
    Member.actions = {
        live: [],
        past: []
    };
    Member.Memberstatus = 1;
    Member.proposals = [proposal_id];
    CreateMember(ACTION,KBZ,member_id,proposal_id).then(function(data, err) {
        if (err) d.reject(new Error('CreateCommitteeMember' + err));
        else d.resolve(data);
    return d.promise;
};


var CreateKbz = function(PARENT, member_id, proposal_id, action_name) {
    var d = Q.defer(),
        kbz = {_id : 'TheKbzDocument'};
    kbz.PARENT = PARENT;
    kbz.actions = {
        live: [],
        past: []
    };
    kbz.kbzStatus = 1;                                     
    kbz.size = 0;
    kbz.pulsesupport = {
        members: [],
        count: 0
    };
    kbz.pulses = {
        Assigned: null,
        OnTheAir: null,
        Past: []
    };
    kbz.proposals = (proposal_id ? [proposal_id] : []);
    db_find('variables', {}, {})
        .then(function(data, err) {
            data[0].Name.value = action_name || 'No Name';
            kbz.variables = data[0];
            var collectionName = randomKbzId();
            db_createCollection(collectionName).then(function(e,d){
                db_insert(collectionName, kbz)
                    .then(function(newkbz, err) {
                        if (err) {}
                        CreatePulse(collectionName).then(function(a, b) {});
                        if (member_id > '') {
                            CreateMember(collectionName, PARENT, member_id, proposal_id);
                        }
                        if (err) d.reject(err);
                        else d.resolve(newkbz);
                    });
            });        
        });
    return d.promise;
};

var CreateAction = function(PARENT, proposal_id, action_name) {
    var d = Q.defer();
    CreateKbz(PARENT, 0, proposal_id, action_name)
        .then(function(newaction, err) {
            db_updateOne('kbz', PARENT, {
                    $push: {
                        "actions.live": newaction._id
                    }
                })
                .then(function(data, err) {
                    if (err) d.reject(err);
                    else d.resolve(data);
                });
        });
    return d.promise;
};


var CreateProposal = function(KBZ, initiator, title, body, type, uniq) {
    //console.log("in CreateProposal",KBZ,initiator,title,body,type,uniq);
    var d = Q.defer(),
        Proposal = {};
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

    /* Set the specific Proposal fields*/
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

var RemoveMember = function(KBZ, member_id, level) {
    console.log("In RemoveMember:", member_id, level);
    var d = Q.defer();
    db_findAndModify(KBZ, {
            '_id': member_id
        }, {
            $set: {
                "status": 0
            }
        })
        .then(function(member, err) {
            if (level === 1) {
                if (member.type === 1) {
                    db_updateOne('users', member.parent, {    /*--------------HERE-------*/
                            $pull: {
                                "memberships": member_id
                            }
                        })
                        .then(null, console.err);
                }
                if (member.type === 2) {
                    db_updateOne('members', member.parent, {
                            $pull: {
                                "actions.live": {
                                    "member_id": member._id,
                                    "action_id": member.KBZ
                                }
                            },
                            $push: {
                                "actions.past": {
                                    "member_id": member._id,
                                    "action_id": member.KBZ
                                }
                            }
                        })
                        .then(null, console.err);
                }
            }
            member.actions.live.forEach(function(action) {
                i = member.actions.live.indexOf(action);
                member.actions.live.splice(i, 1);
                member.actions.past.push(action);
                db_save('members', member)
                    .then(d.resolve(member));
                RemoveMember(action.member_id, level++)
                    .then(null, console.error);
            });
            console.log("exit recursion", level);
            d.resolve(member);
        });
    return d.promise;
};


var AssignetoPulse = function(proposal, pulse_id) {
    console.log("In AssignetoPulse", proposal._id);
    var d = Q.defer();
    db_updateOne('proposals', proposal._id, {
            $set: {
                "status": 4
            }
        })
        .then(db_updateOne('pulses', pulse_id, {
                $push: {
                    "Assigned": proposal._id
                }
            })
            .then(function(data, err) {
                if (err) d.reject(err);
                else d.resolve(proposal);
            })
        );
    return d.promise;
};

var Support = function(KBZ, proposal_id, member_id) {
    var d = Q.defer();
    db_update('proposals', {
            "_id": proposal_id,
            "support.members": {
                $nin: [member_id]
            }
        }, {
            $inc: {
                "support.count": 1
            },
            $push: {
                "support.members": member_id
            }
        })
        .then(function(ret, err) {
            if (ret) {
                db_findOne('kbz', KBZ, {
                        "variables.ProposalSupport.value": 1,
                        "size": 1,
                        "pulses.Assigned": 1
                    })
                    .then(
                        function(kbz, err) {
                            var pulse_id = kbz.pulses.Assigned,
                                ProposalSupport = kbz.variables.ProposalSupport.value,
                                size = kbz.size;
                            db_findOne('proposals', proposal_id)
                                .then(
                                    function(proposal, err) {
                                        var current = proposal.support.count;
                                        var status = proposal.status;
                                        if (status == "3" && (current / size * 100 >= ProposalSupport)) {
                                            AssignetoPulse(proposal, pulse_id).then(null, console.error)
                                                .then(
                                                    function(data, err) {
                                                        if (err) d.reject(err);
                                                        else d.resolve(proposal);
                                                    }
                                                ).then(null, console.error);
                                        }
                                    });
                        });
            } else {
                db_update('proposals', {
                        "_id": proposal_id,
                        "support.members": {
                            $in: [member_id]
                        }
                    }, {
                        $inc: {
                            "support.count": -1
                        },
                        $pull: {
                            "support.members": member_id
                        }
                    })
                    .then(
                        function(data, err) {
                            if (err) d.reject(err);
                            else d.resolve(proposal);
                        });
            }
        });
    return d.promise;
};


var PulseSupport = function(KBZ, member_id) {
    console.log("In PulseSupport", KBZ, member_id);
    var d = Q.defer();
    db_findAndModify('kbz', {
            "_id": KBZ,
            "pulsesupport.members": {
                $nin: [member_id]
            }
        }, {
            $inc: {
                "pulsesupport.count": 1
            },
            $push: {
                "pulsesupport.members": member_id
            }
        })
        .then(
            function(kbz, err) {
                if (kbz) {
                    var current = kbz.pulsesupport.count;
                    var PulseSupport = kbz.variables.PulseSupport.value;
                    var size = kbz.size;
                    if (current / size * 100 >= PulseSupport) {
                        Pulse(KBZ)
                            .then(
                                function(data, err) {
                                    if (err) d.reject(err);
                                    else d.resolve(proposal);
                                }
                            );
                    }
                } else {
                    db_update('kbz', {
                            "_id": KBZ,
                            "pulsesupport.members": {
                                $in: [member_id]
                            }
                        }, {
                            $inc: {
                                "pulsesupport.count": -1
                            },
                            $pull: {
                                "pulsesupport.members": member_id
                            }
                        })
                        .then(
                            function(data, err) {
                                if (err) d.reject(err);
                                else d.resolve(proposal);
                            }
                        );
                }
            }
        );
    return d.promise;
};



var Vote = function(proposal_id, member_id, vote) {
    console.log("Vote :", proposal_id, member_id, vote);
    var d = Q.defer(),
        pro = 0,
        against = 0;
    if (vote === 1) {
        pro = 1;
    } else {
        against = 1;
    }
    db_update('proposals', {
            "_id": proposal_id,
            "votes.members": {
                $nin: [member_id]
            }
        }, {
            $inc: {
                "votes.pro": pro,
                "votes.against": against
            },
            $push: {
                "votes.members": member_id
            }
        })
        .then(d.resolve);
    return d.promise;
};


var ExecuteOnTheAir = function(OnTheAir, variables) {
    console.log("IN ExecuteOnTheAir", OnTheAir);
    var d = Q.defer(),
        proposal_id = OnTheAir.OnTheAir.splice(0, 1);
    console.log("IN ExecuteOnTheAir proposal:", proposal_id, !proposal_id[0]);
    if (!proposal_id[0]) d.resolve(OnTheAir); //All OnTheAir Proposals were Proccessed.
    else {
        console.log("IN ExecuteOnTheAir proposal2:", proposal_id[0]);
        db_findOne('proposals', proposal_id[0])
            .then(function(proposal) {
                console.log("IN ExecuteOnTheAir proposal3:", proposal);
                type = proposal.type;
                var variable = variables[type];
                console.log("IN ExecuteOnTheAir proposal4:", proposal.votes, variable.value);
                if (proposal.votes.pro / (proposal.votes.against + proposal.votes.pro) * 100 >= variable.value) { /*proposal had passed*/
                    console.log("approved ", type);
                    ExecuteVertic(proposal)
                        .then(function(vertic) {
                            console.log("IN ExecuteOnTheAir proposal5: REturned from EV", vertic);
                            proposal.status = "7"; /* Approved */
                            OnTheAir.Approved.push(proposal._id);
                            db_save('proposals', proposal).then(null, console.error);
                            //console.log("111:",OnTheAir.OnTheAir.length,OnTheAir.Rejected.length, OnTheAir.Approved.length);
                            d.resolve(ExecuteOnTheAir(OnTheAir, variables));
                        });
                } else { /*proposal had been rejected*/
                    console.log("Rejected", proposal.type);
                    proposal.status = "8"; /* rejected */
                    OnTheAir.Rejected.push(proposal._id);
                    db_save('proposals', proposal).then(null, console.error);
                    //console.log("222:",OnTheAir.OnTheAir.length,OnTheAir.Rejected.length, OnTheAir.Approved.length);
                    d.resolve(ExecuteOnTheAir(OnTheAir, variables));
                }
            });
    }
    return d.promise;
};

var PulseOnTheAir = function(pulse_id, variables) {
    console.log("IN PulseOnTheAir", pulse_id);
    //if(!pulse_id) {console.log("xxxxxxxxxxxxxxxxxxxxxxxxxxxx");q.resolve(1);}
    var d = Q.defer();
    db_findOne('pulses', pulse_id).fail(d.resolve)
        .then(function(OnTheAir) {
            OnTheAir.status = 3;
            console.log("IN PulseOnTheAir !OnTheAir.OnTheAir[0]", !OnTheAir.OnTheAir[0]);
            if (!OnTheAir.OnTheAir[0]) {
                db_save('pulses', OnTheAir).then(d.resolve);
            }
            //db_find('proposals',{$in : OnTheAir.OnTheAir})
            //  .then(function(proposals){
            ExecuteOnTheAir(OnTheAir, variables)
                .then(function(OnTheAir) {
                    console.log("IN PulseOnTheAir return ontheair: ", OnTheAir);
                    OnTheAir.OnTheAir = [];
                    db_save('pulses', OnTheAir).then(d.resolve);
                });
        });
    return d.promise;
};


var Age = function(KBZ, maxage) {
    console.log("IN Age", KBZ, maxage);
    var d = Q.defer();
    db_update('proposals', {
            "KBZ": KBZ,
            "status": "3",
            "age": {
                $gt: maxage
            }
        }, {
            $set: {
                "status": "5"
            }
        })
        .then(db_update('proposals', {
                "KBZ": KBZ,
                status: "3"
            }, {
                $inc: {
                    "age": 1
                }
            })
            .then(d.resolve).fail(d.resolve)
        );
    return d.promise;
};


var Pulse = function(KBZ) {
    console.log("IN Pulse", KBZ);
    var d = Q.defer();
    db_findOne('kbz', KBZ)
        .then(function(kbz) {
            Age(KBZ, kbz.variables.MaxAge.value)
                .then(PulseOnTheAir(kbz.pulses.OnTheAir, kbz.variables)
                    .then(
                        db_findOne('pulses', kbz.pulses.Assigned)
                        .then(function(Assigned, err) {
                            db_update('proposals', {
                                    "_id": {
                                        $in: Assigned.Assigned
                                    }
                                }, {
                                    $set: {
                                        "status": "6"
                                    }
                                })
                                .then(function() {
                                    Assigned.status = 2;
                                    Assigned.OnTheAir = Assigned.Assigned;
                                    Assigned.Assigned = [];
                                    db_save('pulses', Assigned)
                                        .then(function() {
                                            CreatePulse(KBZ);
                                            kbz.pulses.Past.push(kbz.pulses.OnTheAir);
                                            kbz.pulses.OnTheAir = kbz.pulses.Assigned;
                                            kbz.pulsesupport = {
                                                count: 0,
                                                members: []
                                            };
                                            db_save('kbz', kbz)
                                                .then(d.resolve());
                                        });
                                });
                        }))
                );
        });
    return d.promise;
};


var ExecuteVertic = function(proposal) {
    var d = Q.defer();
    console.log("executing proposal type: ", proposal.type);
    if (proposal.type == "ME") {
        CreateMember(proposal.KBZ, proposal.initiator, proposal._id)
            .then(d.resolve);
    }
    if (proposal.type == "NS") {
        CreateStatement(proposal.KBZ, proposal.statement, proposal._id)
            .then(d.resolve).fail(console.log);
    }
    if (proposal.type == "CS") {
        db_updateOne('statements', proposal.statement_id, {
                $set: {
                    "status": 0
                }
            })
            .then(d.resolve).fail(console.log);
    }
    if (proposal.type == "RS") {
        db_updateOne('statements', proposal.statement_id, {
                $set: {
                    "statement": proposal.newstatement
                }
            })
            .then(d.resolve);
    }
    if (proposal.type == "CV") {
        key = "variables." + proposal.variable + ".value";
        variable = {};
        variable[key] = proposal.newvalue;
        db_updateOne('kbz', proposal.KBZ, {
                $set: variable
            })
            .then(d.resolve);
    }
    if (proposal.type == "NA") {
        CreateAction(proposal.KBZ, proposal._id, proposal.action_name)
            .then(d.resolve);
    }
    if (proposal.type == "CM") {
        CreateCommitteeMember(proposal.action_id, proposal.member_id, proposal._id)
            .then(d.resolve);
    }
    return d.promise;
};

