import mysql from 'mysql2/promise';

const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD
};
let connection;
mysql.createConnection(config).then(c => {
    connection = c;
}).catch(e => {
    console.log('Connection error: Falling back to mocking');
    connection = {
        runner:0,
        expectedOutcomes:[],
        addExpectedOutcome(err,outcome){
            this.expectedOutcomes.push({
                error:err,
                outcome:outcome
            })
        },
        query(sql, cb){
            let res = this.expectedOutcomes[this.runner];
            this.runner++;
            cb(res.error, res.outcome);
        },
        execute(sql, values, cb){
            this.query(sql, cb)
        }
    }
})


export default {
    getConnection(){
        return connection;
    },
    raw(sql){
        return new Promise((resolve, reject)=>{
            connection.query(sql, (err, results) => {
                if (err) reject(err)
                resolve(results)
            })
        })
    },
    query(sql: string, values: Object) {
        return new Promise((resolve, reject) => {
            const prepared = this.prepare(sql, values);
            connection.execute(...prepared, (err, results) => {
                if (err) reject(err)
                resolve(results)
            })
        })

    },
    async get(table, id) {
        try{
            let result = await this.query(`SELECT *, HEX(id) as id FROM \`${table}\` WHERE id = UNHEX({{id}})`, {id});
            return result[0];
        } catch (e) {
            return null;
        }

    },
    insert(table, values) {
        return this.query(`INSERT INTO \`${table}\` SET ${this.generator(values)}`, values)
    },
    find(table, conditions) {
        return this.query(`SELECT *, HEX(id) as id FROM \`${table}\` WHERE ${this.generator(conditions, 'AND')}`, conditions)
    },
    update(table, changeObj){
        return this.query(`UPDATE \`${table}\` SET ${this.generator(changeObj, 'AND')} WHERE id = {{id}}`, changeObj)
    },
    generator(objectValues, separator: string = ','): string {
        let generator = '';
        Object.keys(objectValues).forEach((key, i) => {
            generator += (i > 0 ? separator : '') + ` ${key} = ` + (key==='id' || key.includes('Id')?`UNHEX({{${key}}})`: `{{${key}}}`)
        })
        return generator.length < 1 ? '1=1' : generator;
    },
    prepare(sql: string, values: Object): Array<any> {
        const passIns: Array<any> = [];
        let matches = sql.match(/{{([\sa-z0-9_-]+)}}/ig);
        if(matches){
            matches.forEach(match => {
                const key = match.substring(2, match.length-2);
                if (typeof values[key] !== 'undefined') {
                    passIns.push(values[key])
                }
            })
        }

        return [sql.replace(/{{[\sa-z0-9_-]+}}/ig, '?'), passIns];
    }
}
