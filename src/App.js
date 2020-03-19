import React, { Component } from "react";
import Grid from '@material-ui/core/Grid';
import Container from '@material-ui/core/Container';
import Input from "@material-ui/core/Input";
import ExpansionPanel from '@material-ui/core/ExpansionPanel';
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary';
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import Typography from '@material-ui/core/Typography';
import Link from '@material-ui/core/Link';
import { BrowserRouter as Router, Route } from "react-router-dom";
import qs from 'query-string';


const runRequest = async (body) => {
  const response = await fetch(".netlify/functions/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return response.json();
}


const buildRequest = (searchTerm) => {
  const body = {
    size: 50,
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


const ResultItem = ({ data }) => {
  const url = `http://${data._id}`; 
  const esUrl = genEsLink(data._id) 
  return (
    <ExpansionPanel>
      <ExpansionPanelSummary
        expandIcon={<ExpandMoreIcon />}
      >
        <Typography>
          <Link target="_blank" href={url}>
            {data._id}
          </Link>
        </Typography>
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
}


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
  return responseJson.hits.hits;
}

class Search extends Component {
  constructor(props) {
    super(props);
    const text = extractQueryString(props);
    this.state = {
      text: text,
      results: []
    }
  }

  componentDidMount = async () => {
    const results = await fetchResults(this.state.text);
    this.setState({ results });
  }

  handleInputChange = async event => {
    const text = event.target.value;
    this.props.history.push({
      search: text ? qs.stringify({q: text}) : ""
    })
    this.setState({ text })
    const results = await fetchResults(text);
    this.setState({ results });
  }


  render() {
    const { text, results } = this.state;
    return (
      <Grid
        container
      >
        <Container>
          <Input
            value={text}
            fullWidth
            onChange={this.handleInputChange}
          />
        </Container>
        <Container>
          {results.map(hit => <ResultItem key={hit._id} data={hit} />)}
        </Container>
      </Grid>
    );
  }
}


const App = () => {
  return (
    <Router>
      <Route path="/" component={Search} />
    </Router>
  );
}

export default App;