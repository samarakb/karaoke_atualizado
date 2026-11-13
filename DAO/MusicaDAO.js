const supabase = require('../supabaseClient');
const { Musica } = require('../karaoke/musica');
const { Parte } = require('../karaoke/parte');

class MusicaDAO {
    
    // Transforma a linha do banco no objeto da classe Musica
    _paraMusica(linha) {
        // O Supabase pode trazer o artista aninhado ou só o id dependendo da consulta
        const nomeArtista = linha.artistas ? linha.artistas.nome : 'Artista Desconhecido';
        const musica = new Musica(linha.nome, nomeArtista);
        musica.id = linha.id;
        return musica;
    }

    // Transforma a linha do banco no objeto da classe Parte
    _paraParte(linha) {
        const parte = new Parte(linha.letra, linha.tempo_espera, linha.tag);
        parte.id = linha.id;
        parte.ordem = linha.ordem;
        return parte;
    }

    async listarTodas() {
        const { data, error } = await supabase
            .from('musicas')
            .select('id, nome, artistas(nome)')
            .order('id');

        if (error) throw new Error('Erro ao listar músicas: ' + error.message);

        return data.map(linha => this._paraMusica(linha));
    }

    async buscarPorId(id) {
        // 1. Busca a música
        const { data: musicaData, error: erroMusica } = await supabase
            .from('musicas')
            .select('id, nome, artistas(nome)')
            .eq('id', id)
            .maybeSingle(); // maybeSingle retorna null se não achar, em vez de erro

        if (erroMusica) throw new Error('Erro ao buscar música: ' + erroMusica.message);
        if (!musicaData) return null;

        const musica = this._paraMusica(musicaData);

        // 2. Busca as partes dessa música
        const { data: partesData, error: erroPartes } = await supabase
            .from('partes')
            .select('id, ordem, letra, tempo_espera, tag')
            .eq('musica_id', id)
            .order('ordem'); // Ordem é muito importante para o karaokê!

        if (erroPartes) throw new Error('Erro ao buscar partes: ' + erroPartes.message);

        // 3. Adiciona as partes na música
        partesData.forEach(linha => {
            musica.addParte(this._paraParte(linha));
        });

        return musica;
    }

    async inserir(nome, artistaNome) {
        // O banco exige um artista_id. Primeiro, buscamos ou criamos o artista.
        let { data: artistaData, error: erroBusca } = await supabase
            .from('artistas')
            .select('id')
            .eq('nome', artistaNome)
            .maybeSingle();

        if (erroBusca) throw new Error('Erro ao buscar artista: ' + erroBusca.message);

        if (!artistaData) {
            const { data: novoArtista, error: erroInsertArtista } = await supabase
                .from('artistas')
                .insert({ nome: artistaNome })
                .select()
                .single();
            
            if (erroInsertArtista) throw new Error('Erro ao criar artista: ' + erroInsertArtista.message);
            artistaData = novoArtista;
        }

        // Agora inserimos a música
        const { data: musicaData, error: erroInsert } = await supabase
            .from('musicas')
            .insert({ nome: nome, artista_id: artistaData.id })
            .select('id, nome, artistas(nome)')
            .single();

        if (erroInsert) throw new Error('Erro ao criar música: ' + erroInsert.message);

        return this._paraMusica(musicaData);
    }

    async adicionarPartes(idMusica, parte) {
        if (!(parte instanceof Parte)) return false;

        // Descobrir a próxima "ordem" (0, 1, 2...)
        const { data: partesExistentes, error: erroBusca } = await supabase
            .from('partes')
            .select('ordem')
            .eq('musica_id', idMusica)
            .order('ordem', { ascending: false })
            .limit(1);

        if (erroBusca) throw new Error('Erro ao buscar partes: ' + erroBusca.message);

        const proximaOrdem = partesExistentes.length > 0 ? partesExistentes[0].ordem + 1 : 0;

        const { error: erroInsert } = await supabase
            .from('partes')
            .insert({
                musica_id: idMusica,
                ordem: proximaOrdem,
                letra: parte.letra,
                tempo_espera: parte.tempoEspera,
                tag: parte.tag
            });

        if (erroInsert) throw new Error('Erro ao adicionar parte: ' + erroInsert.message);
        return true;
    }

    async atualizar(id, nome, artistaNome) {
        // 1. Buscar ou criar o novo artista
        let { data: artistaData, error: erroBusca } = await supabase
            .from('artistas')
            .select('id')
            .eq('nome', artistaNome)
            .maybeSingle();

        if (erroBusca) throw new Error('Erro ao buscar artista: ' + erroBusca.message);

        if (!artistaData) {
            const { data: novoArtista, error: erroInsertArtista } = await supabase
                .from('artistas')
                .insert({ nome: artistaNome })
                .select()
                .single();
            
            if (erroInsertArtista) throw new Error('Erro ao criar artista: ' + erroInsertArtista.message);
            artistaData = novoArtista;
        }

        // 2. Atualizar a música
        const { data: musicaData, error: erroUpdate } = await supabase
            .from('musicas')
            .update({ nome: nome, artista_id: artistaData.id })
            .eq('id', id)
            .select('id, nome, artistas(nome)')
            .maybeSingle();

        if (erroUpdate) throw new Error('Erro ao atualizar música: ' + erroUpdate.message);
        if (!musicaData) return null;

        return this._paraMusica(musicaData);
    }

    async remover(id) {
        // Como o banco tem "on delete cascade", as partes vão sumir junto automaticamente
        const { data, error } = await supabase
            .from('musicas')
            .delete()
            .eq('id', id)
            .select('id, nome, artistas(nome)')
            .maybeSingle();

        if (error) throw new Error('Erro ao remover música: ' + error.message);
        if (!data) return null;

        return this._paraMusica(data);
    }
}

// Exporta uma INSTÂNCIA única (Singleton)
module.exports = new MusicaDAO();