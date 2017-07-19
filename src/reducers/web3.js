import { default as config } from '../config.js';
import { getICOParameters, isConnected, web3Connect } from '../utils/web3';
import { setProperties, errorMessage, resetRpc } from '../actions/ScanAction';
import { computeICOTransparency } from '../utils';
import { getICOLogs, getStatistics, initStatistics } from '../utils.js';
import { setCurrency } from '../actions/CurrencyAction';
import { drawStatistics, hideLoader, showLoader } from '../actions/ScanAction';

export const web3Connection = () => async (dispatch, getState) => {
  console.log('Start Web3 connection');
  if (isConnected() === false) {
    await dispatch(resetRpc());
    await dispatch(errorMessage());
    return;
  }

  if (getState().modal.web3) { return; }

  const web3 = web3Connect();
  await dispatch({ type: 'SET_WEB3_CONNECTION', web3 });
};

export const readSmartContract = address => async (dispatch, getState) => {
  const web3 = getState().modal.web3;
  console.log(`Reading Smart contract , RPC connection ${web3 ? 'Connected' : 'Disconnected'}`);
  if (!web3) {
    return;
  }
  const matrix = config.ICOs[address].matrix;
  const transparencyDecision = computeICOTransparency(matrix)[0];

  dispatch(setProperties(address, { decision: transparencyDecision }));
  getICOParameters(web3, address).then((parameters) => {
    Object.keys(parameters).forEach((constant) => {
      const parameter = parameters[constant];
      if (parameter === null) return;
      const tempResult = {};
      if (typeof parameter === 'object' && typeof parameter.then === 'function') {
        parameter.then(async (value) => {
          if (typeof value === 'function')
            {tempResult[constant] = await value(web3);}
          else { tempResult[constant] = value; }

          dispatch(setProperties(address, tempResult));
        });
      } else {
        tempResult[constant] = parameter;
        dispatch(setProperties(address, tempResult));
      }
    });
  });
};

export const getLogs = address => async (dispatch, getState) => {
  dispatch(showLoader());
  const web3 = getState().modal.web3;
  if (!web3) {
    dispatch(errorMessage());
    return;
  }
  console.log('Start working on logs');
  getICOLogs(web3, address, async (error, logs) => {
    dispatch(hideLoader());

    if (error || logs.length === 0) dispatch({ type: error });
    else {
            // 1- set currency
            // 2- read smart contract
            // 3- get statistics
            // 4- dispatch statistics to the state
      setCurrency('EUR', new Date(), dispatch);
      const smartContractConstants = await getICOParameters(web3, address);
      const ico = config.ICOs[address];
      ico.decimals = smartContractConstants.decimals;
      const statistics = getStatistics(ico, logs, initStatistics(), getState().currency.value);
      dispatch(drawStatistics(statistics));
    }
  });
};
