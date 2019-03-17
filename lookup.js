const
    log = require('loglevel').getLogger('lookup');

const
    OPENHAB_VALUE = 'number',
    OPENHAB_UNIT = 'openhab_unit',
    OPENHAB_SET = 'set',
    OPENHAB_DEFAULT_ITEM = 'default',
    OPENHAB_STATE = 'openhab_state';

class Lookup {
    constructor(config, sitemap) {
        this.sitemap = sitemap;
        this.config = config;
        this.confidenceLevel = parseFloat(this.config.confidenceLevel);
    }

    reloadConfigs() {
        this.sitemap.reload();
    }

    witAiMessageResult({
        _text,
        entities
    }) {
        log.trace("Entities: {}", entities);
        let confidentEntities = this.getConfidentEntities(entities);
        let possibleOptions = this.findPossibleOptions(this.sitemap, confidentEntities, []);
        let selection = this.getExactMatch(possibleOptions);
        return Promise.resolve(selection ? {
            queryString: _text,
            selection
        } : {
            queryString: _text,
            possibleOptions
        });
    }

    findPossibleOptions(parent, entities, parentCandidates) {
        let possibleOptions = [];
        for (const [nodeName, node] of Object.entries(parent)) {
            if (nodeName == OPENHAB_DEFAULT_ITEM) {
                let possibleOption = this.checkPossibleOption(entities, parentCandidates, node)
                if (possibleOption) {
                    possibleOptions.push(possibleOption);
                }
            } else if (nodeName == OPENHAB_STATE) {
                let candidates = this.getCandidates(parentCandidates, nodeName, null);
                let possibleOption = this.checkPossibleOption(entities, candidates, node)
                if (possibleOption) {
                    possibleOptions.push(possibleOption);
                }
            } else {
                for (const [valueNodeName, valueNode] of Object.entries(node)) {
                    let candidates = this.getCandidates(parentCandidates, nodeName, valueNodeName);
                    if (typeof valueNode == 'object') {
                        this.findPossibleOptions(valueNode, entities, candidates).forEach((e) => possibleOptions.push(e));
                    } else {
                        let finalCandidates = valueNodeName == OPENHAB_SET ? this.getCandidates(candidates, OPENHAB_VALUE, null) : candidates;
                        let possibleOption = this.checkPossibleOption(entities, finalCandidates, valueNode)
                        if (possibleOption) {
                            possibleOptions.push(possibleOption);
                        }
                    }
                }
            }
        }
        return possibleOptions;
    }

    getCandidates(parentCandidates, entity, value) {
        let candidate = {
            entity: entity,
            value: value
        };
        let candidates = parentCandidates.slice(0);
        candidates.push(candidate);
        return candidates;
    }

    checkPossibleOption(entities, candidates, itemNode) {
        let missingNodes = [];
        var matched = 0;
        var value = undefined;
        candidates.forEach((candidate) => {
            let candidateEntity = candidate.entity;
            let entity = entities[candidateEntity];
            if (candidateEntity == OPENHAB_VALUE || candidateEntity == OPENHAB_STATE) {
                if (entity) {
                    value = entity.value;
                    matched++;
                } else {
                    value = null;
                }
            } else {
                if (entity) {
                    if (entity.value != candidate.value) return null;
                    matched++;
                } else {
                    missingNodes.push(candidate);
                }
            }
        });
        if (Object.keys(entities).length > matched) return null;
        return {
            itemNode: itemNode,
            missingNodes: missingNodes,
            value: value
        };
    }

    getExactMatch(possibleOptions) {
        for (let possibleOption of possibleOptions) {
            if (possibleOption.missingNodes.length == 0) return possibleOption;
        }
        return null;
    }

    getConfidentEntities(entities) {
        let result = {};
        for (const [entityName, entity] of Object.entries(entities)) {
            if (entityName != OPENHAB_UNIT) {
                let confidentEntityEntry = entityName == OPENHAB_VALUE ? this.getConfidentValueEntityEntry(entity) : this.getConfidentEntityEntry(entity);
                if (confidentEntityEntry != null) {
                    result[entityName] = confidentEntityEntry;
                }
            }
        }
        return result;
    }

    getConfidentValueEntityEntry(entity) {
        if (entity.length == 1 && entity[0].confidence > this.confidenceLevel) {
            return entity[0];
        }
        return null;
    }

    getConfidentEntityEntry(entity) {
        for (let entityEntry of entity) {
            if (entityEntry.confidence > this.confidenceLevel) {
                return entityEntry;
            }
        }
        return null;
    }

}

module.exports = Lookup;