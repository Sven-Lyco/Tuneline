import { LegalPage, Operator } from '../components/LegalPage';
import { SOURCE_URL } from '../constants';
import { useLegalInfo } from '../hooks/useLegalInfo';

interface PrivacyScreenProps {
  onBack: () => void;
}

/**
 * Spotify's Developer Terms (V.12) want this before the login, and the GDPR applies to a public
 * website. Keep it in line with the code: what's stored, where, and for how long.
 */
export function PrivacyScreen({ onBack }: PrivacyScreenProps) {
  const info = useLegalInfo();
  return (
    <LegalPage title="Datenschutz" onBack={onBack}>
      <p>
        Tuneline ist ein privates, nicht-kommerzielles Hobbyprojekt. Welche Daten Tuneline erhebt
        und wie es sie nutzt, richtet sich nach dieser Datenschutzerklärung.
      </p>

      <h2>Verantwortlich</h2>
      <p>
        <Operator info={info} />
      </p>
      <p>
        Quellcode und Fragen zum Projekt:{' '}
        <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </p>

      <h2>Wenn du einen Raum erstellst (Spotify-Login)</h2>
      <ul>
        <li>
          Du meldest dich über Spotify an. Tuneline darf dabei nur deine eigenen und gemeinsamen
          Playlists lesen.
        </li>
        <li>
          Der Zugangsschlüssel von Spotify liegt nur auf dem Server, nie in deinem Browser. Außerdem
          kennt der Server deine Spotify-Nutzer-ID, um eigene von gefolgten Playlists zu
          unterscheiden.
        </li>
        <li>
          Gelesen werden die Namen und Cover deiner Playlists und daraus Titel, Interpret,
          Erscheinungsjahr und Cover der Songs. Das liegt nur im Arbeitsspeicher des Servers,
          höchstens sechs Stunden.
        </li>
        <li>
          Ein Cookie (<code>tuneline_session</code>) hält dich bis zu sieben Tage angemeldet.
        </li>
      </ul>

      <h2>Wenn du mitspielst</h2>
      <p>
        Gespeichert werden dein selbst gewählter Spielername, der Raum-Code und dein Spielstand, nur
        im Arbeitsspeicher des Servers. Das verschwindet spätestens zwei Stunden nach dem Spiel und
        bei jedem Neustart des Servers. Wer im selben Raum spielt, sieht deinen Namen, deine
        Timeline und deine Reaktionen.
      </p>

      <h2>Speicher in deinem Browser</h2>
      <ul>
        <li>
          Für den Tab (sessionStorage): Raum-Code und Platz im Raum, damit du nach dem Neuladen
          weiterspielst; die gewählten Playlists.
        </li>
        <li>
          Dauerhaft (localStorage): der letzte Raum für „Zurück ins Spiel“ (zwei Stunden), die
          Lautstärke und die gespielten Songs (24 Stunden), damit sich Songs nicht wiederholen.
        </li>
      </ul>

      <h2>Server-Logs</h2>
      <p>
        Für Betrieb, Fehlersuche und Schutz vor Missbrauch protokolliert der Server Zeitpunkt,
        aufgerufenen Pfad ohne Parameter, Statuscode, Antwortzeit und eine gekürzte IP-Adresse (ohne
        den letzten Block), dazu Spielereignisse ohne Namen (Raum-Code, Spieler-ID). Die Logs werden
        weder ausgewertet noch weitergegeben und regelmäßig gelöscht.
      </p>

      <h2>Spotify, Apple und MusicBrainz</h2>
      <ul>
        <li>
          Die Cover lädt dein Browser direkt von Spotify, die Hörproben direkt von Apple (iTunes).
          Dabei erhalten Spotify und Apple deine IP-Adresse. Es gelten deren Datenschutzerklärungen:{' '}
          <a
            href="https://www.spotify.com/de/legal/privacy-policy/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Spotify
          </a>
          ,{' '}
          <a
            href="https://www.apple.com/de/legal/privacy/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple
          </a>
          .
        </li>
        <li>
          Der Server fragt die Spotify-Schnittstelle mit deinem Zugangsschlüssel ab. Hörproben sucht
          er bei iTunes, das Erscheinungsjahr bei MusicBrainz (MetaBrainz Foundation), beides nur
          nach Interpret und Titel, ohne Daten über dich. Dein Browser hat mit MusicBrainz keinen
          Kontakt.
        </li>
        <li>
          Der Server läuft bei einem Hosting-Anbieter, der dabei als Auftragsverarbeiter auf die
          Daten zugreifen kann. Darüber hinaus gibt Tuneline keine Daten weiter, zeigt keine Werbung
          und erstellt keine Auswertungen oder Profile.
        </li>
      </ul>

      <h2>Cookies</h2>
      <p>
        Tuneline setzt nur das oben genannte, technisch notwendige Cookie für den Spotify-Login,
        keine Cookies für Tracking oder Werbung. Dritte setzen über Tuneline keine Cookies.
        „Abmelden“ löscht das Cookie; außerdem kannst du Cookies in deinem Browser verwalten und
        löschen.
      </p>

      <h2>Spotify-Verbindung trennen</h2>
      <p>
        „Abmelden“ beendet die Sitzung und löscht die zwischengespeicherten Playlist-Daten sofort.
        Den Zugriff von Tuneline auf dein Spotify-Konto entziehst du dauerhaft unter{' '}
        <a href="https://www.spotify.com/account/apps/" target="_blank" rel="noopener noreferrer">
          spotify.com/account/apps
        </a>
        .
      </p>

      <h2>Rechtsgrundlagen</h2>
      <p>
        Art. 6 Abs. 1 lit. b DSGVO, weil du das Spiel nutzt, und Art. 6 Abs. 1 lit. f DSGVO für die
        Logs (berechtigtes Interesse an einem sicheren Betrieb).
      </p>

      <h2>Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
        Datenübertragbarkeit und Widerspruch. Schreib dafür an den oben genannten Kontakt. Du kannst
        dich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren.
      </p>

      <h2>Spotify als begünstigter Dritter</h2>
      <p>
        Spotify ist begünstigter Dritter dieser Datenschutzerklärung und der Nutzungsbedingungen und
        kann sie unmittelbar durchsetzen.
      </p>

      <p>Stand: Oktober 2026</p>
    </LegalPage>
  );
}
