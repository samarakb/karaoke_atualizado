// 1. Importar o Express
const express = require('express');

// importação da Parte
const { Parte } = require('./karaoke/parte');

// importação do DAO de músicas
const musicaDAO = require('./DAO/MusicaDAO');

// 2. Criar a aplicação
const app = express();

// 3. Configurar middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3.1 Rotas public
app.use(express.static('public'));

// 4. Definir rotas

app.get('/', (req, res) => {
    res.send('Olá, cliente!');
});

app.get('/api/musicas', async (req, res, next) => {
    try {
        const musicas = await musicaDAO.listarTodas();
        const resumo = musicas.map(m => ({
            id: m.id,
            nome: m.nome,
            artista: m.artista,
            totalPartes: m.partes.length
        }));
        res.json(resumo);
    } catch (err) {
        next(err);
    }
});

app.get('/api/musicas/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const musica = await musicaDAO.buscarPorId(id);

        if (!musica) {
            return res.status(404).json({ erro: `Música com id ${id} não encontrada` });
        }
        res.json(musica);
    } catch (err) {
        next(err);
    }
});

app.post('/api/musicas', async (req, res, next) => {
    try {
        const { nome, artista } = req.body;
        if (!nome || !artista) {
            return res.status(400).json({ erro: 'Campos obrigatórios: nome, artista' });
        }
        const novaMusica = await musicaDAO.inserir(nome, artista);
        res.status(201).json(novaMusica);
    } catch (err) {
        next(err);
    }
});

app.put('/api/musicas/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const { nome, artista } = req.body;
        if (!nome || !artista) {
            return res.status(400).json({ erro: 'Campos obrigatórios: nome, artista' });
        }
        const musicaAtualizada = await musicaDAO.atualizar(id, nome, artista);
        if (!musicaAtualizada) {
            return res.status(404).json({ erro: `Música com id ${id} não encontrada` });
        }
        res.status(200).json(musicaAtualizada);
    } catch (err) {
        next(err);
    }
});

app.delete('/api/musicas/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const musicaRemovida = await musicaDAO.remover(id);
        if (!musicaRemovida) {
            return res.status(404).json({ erro: `Música com id ${id} não encontrada` });
        }
        res.status(200).json(musicaRemovida);
    } catch (err) {
        next(err);
    }
});

app.post('/api/musicas/:id/partes', async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const { letra, tempoEspera, tag } = req.body;

        if (!letra || !tempoEspera || !tag) {
            return res.status(400).json({ erro: 'Campos obrigatórios: letra, tempoEspera, tag' });
        }

        const musica = await musicaDAO.buscarPorId(id);
        if (!musica) {
            return res.status(404).json({ erro: `Música com id ${id} não encontrada` });
        }

        const parte = new Parte(letra, tempoEspera, tag);
        const adicionada = await musicaDAO.adicionarPartes(id, parte);

        if (!adicionada) {
            return res.status(404).json({ erro: `Música com id ${id} não encontrada` });
        }

        res.status(201).json(musica);
    } catch (err) {
        next(err);
    }
});

// Middleware para tratamento de erros
app.use((err, req, res, next) => {
    console.error('Erro no servidor:', err.message);

    if (err.status === 400) {
        return res.status(400).json({
            erro: 'JSON inválido no corpo da requisição'
        });
    }

    res.status(500).json({
        erro: 'Erro interno do servidor'
    });
});

const PORT = process.env.PORT || 3000;

// Inicia o servidor
app.listen(PORT, () => {
    console.log('Servidor iniciado.');
});