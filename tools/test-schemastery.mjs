const leaf = (kind) => { const schema = { kind, default(value) { schema._default=value; return schema } }; return schema }
const z = { string: () => leaf('string'), number: () => leaf('number'), boolean: () => leaf('boolean'), array: item => Object.assign(leaf('array'), { item }), object: shape => Object.assign(leaf('object'), { shape }) }
export default z
export { z }
