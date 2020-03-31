import React, { Component, Fragment, memo } from "react";
import InputBase from "@material-ui/core/InputBase";
import ExpansionPanel from '@material-ui/core/ExpansionPanel';
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary';
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import Typography from '@material-ui/core/Typography';
import Link from '@material-ui/core/Link';
import Button from '@material-ui/core/Button';
import ButtonGroup from '@material-ui/core/ButtonGroup';
import Box from '@material-ui/core/Box';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from "@material-ui/core/Toolbar";
import SearchIcon from "@material-ui/icons/Search";
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import TextField from '@material-ui/core/TextField';
import { BrowserRouter as Router, Route } from "react-router-dom";
import qs from 'query-string';
import debounce from "lodash/debounce";

const runRequest = async body => {
  const response = await fetch(".netlify/functions/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return response.json();
}

const buildRequest = searchTerm => {
  const body = {
    size: 200,
    query: {
      match: {
        body: searchTerm
      }
    }
  };
  return body;
}

const genEsLink = id => {
  const url = new URL(`/crawler/_doc/${encodeURIComponent(id)}`,
    process.env.REACT_APP_ELASTICSEARCH_HOST)
  return url;
}

const EvalButtons = ({ selected, onGradeUpdate }) => {
  return (
    <ButtonGroup
      variant="text"
      color="primary"
      aria-label="text primary button group"
      onClick={e => e.stopPropagation()}
      size="small"
    >
      {["non-relevant", "relevant", "very relevant"].map((rating, index) => {
        const isSelected = index === selected;
        return (
          <Button
            key={rating}
            color={isSelected ? "secondary" : "primary"}
            onClick={() => onGradeUpdate(index)}
          >
            {rating}
          </Button>
        );
      })}
    </ButtonGroup>
  );
}

const ResultItem = memo(({ doc, onGradeUpdate }) => {
  const url = `http://${doc._id}`;
  const esUrl = genEsLink(doc._id)
  return (
    <ExpansionPanel>
      <ExpansionPanelSummary
        expandIcon={<ExpandMoreIcon />}
      >
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          width="100%"
        >
          <Link
            onClick={e => e.stopPropagation()}
            target="_blank" href={url}
          >
            {doc._id}
          </Link>
          <Box>
            <EvalButtons 
              selected={doc.grade} 
              onGradeUpdate={grade => onGradeUpdate(doc._id, grade)} 
            />
          </Box>
        </Box>
      </ExpansionPanelSummary>
      <ExpansionPanelDetails>
        <Typography>
          ElasticSearch doc:&nbsp;
          <Link href={esUrl} target="_blank">
            {esUrl.toString()}
          </Link>
        </Typography>
      </ExpansionPanelDetails>
    </ExpansionPanel>
  );
}, (prevProps, nextProps) => {
  return prevProps.doc._id === nextProps.doc._id 
    && prevProps.doc.grade === nextProps.doc.grade;
});

const extractQueryString = ({ history }) => {
  const { search } = history.location;
  let text = "";
  if (search) {
    const parsed = qs.parse(search);
    text = parsed.q || "";
  }
  return text;
}

const fetchResults = async text => {
  if (text.length < 3) {
    return [];
  }
  const requestBody = buildRequest(text);
  const responseJson = await runRequest(requestBody);
  return responseJson.hits.hits.map(hit => ({ ...hit, grade: -1 }));
}

const SearchResults = memo(({ results, onGradeUpdate }) => {
  return (
    <Box marginTop={8}>
      {results.map(doc => 
        <ResultItem key={doc._id} doc={doc} onGradeUpdate={onGradeUpdate} />)}
    </Box>
  );
});


class Search extends Component {
  constructor(props) {
    super(props);
    const text = extractQueryString(props);
    this.state = {
      queryId: "",
      assessorId: "Steven_Than",
      text: text,
      results: [],
      downloadDialogOpen: false
    }
  }

  componentDidMount = async () => {
    const results = await fetchResults(this.state.text);
    this.setState({ results });
  }

  handleGradeUpdate = (docId, grade) => {
    const results = this
      .state
      .results
      .map(doc => doc._id === docId ? { ...doc, grade } : doc);
    this.setState({ results })
  }

  debouncedRequest = debounce(async text => {
    const results = await fetchResults(text);
    this.setState({ results });
  }, 300);

  handleInputChange = event => {
    const text = event.target.value;
    this.setState({ text });
    this.props.history.push({
      search: text ? qs.stringify({ q: text }) : ""
    })
    this.debouncedRequest(text);
  }

  handleDownloadQrel = event => {
    const { queryId, assessorId, results } = this.state;
    const element = document.createElement("a");
    const data = results
      .filter(doc => [0, 1, 2].includes(doc.grade))
      .map(doc => 
      `${queryId} ${assessorId} ${doc._id} ${doc.grade}\n`);
    const file = new Blob(data, { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = "qrel.txt";
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
  }

  render() {
    const { 
      queryId, 
      assessorId, 
      text, 
      results, 
      downloadDialogOpen 
    } = this.state;
    return (
      <Fragment>
        <AppBar position="fixed">
          <Toolbar>
            <SearchIcon />
            <InputBase
              style={{ paddingLeft: 10, color: "#fff" }}
              placeholder="Input your query here"
              value={text}
              fullWidth
              onChange={this.handleInputChange}
            />
            <Button
              variant="contained"
              color="secondary"
              onClick={() => this.setState({ downloadDialogOpen: true })}
            >
              Download
            </Button>
          </Toolbar>
        </AppBar>
        <SearchResults results={results} onGradeUpdate={this.handleGradeUpdate} />
        <Dialog
          open={downloadDialogOpen}
          onClose={() => this.setState({ downloadDialogOpen: false })}
        >
          <DialogTitle>Download QREL file</DialogTitle>
          <DialogContent>
            <Typography>
              Query: {text}
            </Typography>
            <TextField
              value={queryId}
              label="QueryID"
              fullWidth
              onChange={e => this.setState({ queryId: e.target.value })}
            />
            <TextField
              value={assessorId}
              label="AssessorID"
              fullWidth
              onChange={e => this.setState({ assessorId: e.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => this.setState({ downloadDialogOpen: false })}
              color="primary"
            >
              Cancel
            </Button>
            <Button 
              onClick={this.handleDownloadQrel}
              variant="contained" 
              color="secondary" 
              autoFocus
            >
              Download
            </Button>
          </DialogActions>
        </Dialog>
      </Fragment>
    );
  }
}

const App = () => {
  return (
    <div>
      <Router>
        <Route path="/" component={Search} />
      </Router>
    </div>
  );
}

export default App;