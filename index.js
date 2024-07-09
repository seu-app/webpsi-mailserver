const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

// Configuração do banco de dados PostgreSQL
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'vmail',
  password: '12345678',
  port: 5432,
});

async function addDomainAndAccount(domain, email, password) {
    const client = await pool.connect();
  
    try {
      await client.query('BEGIN');
  
      // Adicionar domínio
      await client.query('INSERT INTO domain (domain) VALUES ($1)', [domain]);
  
      // Hash da senha
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Adicionar conta
      const maildir = `${domain}/${email}/`;
      await client.query(
        'INSERT INTO mailbox (username, password, name, maildir, quota, domain, active) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [email, hashedPassword, email, maildir, 2048, domain, true]
      );
  
      // Adicionar alias
      await client.query(
        'INSERT INTO alias (address, goto, domain, active) VALUES ($1, $2, $3, $4)',
        [email, email, domain, true]
      );
  
      await client.query('COMMIT');
      console.log('Domínio e conta adicionados com sucesso');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Erro ao adicionar domínio e conta:', error);
      throw error;
    } finally {
      client.release();
    }
  }

async function removeDomain(domain) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Remover aliases associados ao domínio
    await client.query('DELETE FROM alias WHERE domain = $1', [domain]);

    // Remover contas de e-mail associadas ao domínio
    await client.query('DELETE FROM mailbox WHERE domain = $1', [domain]);

    // Remover o domínio
    const result = await client.query('DELETE FROM domain WHERE domain = $1', [domain]);

    if (result.rowCount === 0) {
      throw new Error('Domínio não encontrado');
    }

    await client.query('COMMIT');
    console.log('Domínio e contas associadas removidos com sucesso');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao remover domínio:', error);
    throw error;
  } finally {
    client.release();
  }
}

app.post('/add-domain-and-account', async (req, res) => {
  const { domain, email, password } = req.body;
  try {
    await addDomainAndAccount(domain, email, password);
    res.status(200).json({ message: 'Domínio e conta adicionados com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao adicionar domínio e conta' });
  }
});

app.delete('/remove-domain', async (req, res) => {
  const { domain } = req.body;
  try {
    await removeDomain(domain);
    res.status(200).json({ message: 'Domínio e contas associadas removidos com sucesso' });
  } catch (error) {
    if (error.message === 'Domínio não encontrado') {
      res.status(404).json({ error: 'Domínio não encontrado' });
    } else {
      res.status(500).json({ error: 'Erro ao remover domínio' });
    }
  }
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));